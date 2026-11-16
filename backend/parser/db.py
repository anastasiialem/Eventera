"""Writes events to Supabase, following the algorithm in supabase/README.md:

1. Find or create the venue (venues) and the artists (artists, including aliases).
2. If (source_id, external_id) is already in event_sources, update the price and last_seen_at.
3. Otherwise call find_duplicate_event(...): if the same event already came from
   another site, add only a new event_sources row.
4. Otherwise create a new events row + event_sources + event_artists (+ event_genres).

Required environment variables (backend/.env file):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...      <- server only, never commit it
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from rapidfuzz import fuzz

from .models import ParsedEvent
from .slug import slugify

ARTIST_SIMILARITY = 80  # 0-100: how similar two spellings must be to count as the same artist


def _norm(name: str) -> str:
    # "&", "and" and Russian "и" all mean the Ukrainian "і" ("and")
    return " ".join(name.lower().replace("&", "і").replace(" and ", " і ").replace(" и ", " і ").split())


def connect():
    """Supabase client with the service_role key (the only key allowed to write)."""
    from supabase import create_client  # imported here so tests run without the package

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from backend/.env")
    return create_client(url, key)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _first(resp):
    return resp.data[0] if resp.data else None


class EventWriter:
    """Writes ParsedEvents to the database. Caches lookup ids to avoid repeated queries."""

    def __init__(self, client):
        self.db = client
        self._sources: dict[str, int] = {}
        self._venues: dict[str, int] = {}
        self._artists: dict[str, int] = {}
        self._genres: dict[str, int] = {}

    # ---------- lookup tables ----------
    def source_id(self, code: str) -> int:
        if code not in self._sources:
            row = _first(self.db.table("sources").select("id").eq("code", code).limit(1).execute())
            if not row:
                raise ValueError(f"Source '{code}' is not in the sources table; add it in a migration")
            self._sources[code] = row["id"]
        return self._sources[code]

    def venue_id(self, name: str, address: str | None) -> int | None:
        if not name:
            return None
        slug = slugify(name)
        if slug in self._venues:
            return self._venues[slug]
        row = _first(self.db.table("venues").select("id, address").eq("slug", slug).limit(1).execute())
        if row:
            if address and not row.get("address"):
                self.db.table("venues").update({"address": address}).eq("id", row["id"]).execute()
            vid = row["id"]
        else:
            vid = _first(self.db.table("venues").insert(
                {"name": name, "slug": slug, "address": address}).execute())["id"]
        self._venues[slug] = vid
        return vid

    def artist_id(self, name: str) -> int:
        slug = slugify(name)
        if slug in self._artists:
            return self._artists[slug]
        row = _first(self.db.table("artists").select("id").eq("slug", slug).limit(1).execute())
        if not row:  # another spelling: 'Zhadan i Sobaky' for 'Жадан і Собаки'
            row = _first(self.db.table("artists").select("id").contains("aliases", [name]).limit(1).execute())
        if not row:
            row = _first(self.db.table("artists").insert({"name": name, "slug": slug}).execute())
        self._artists[slug] = row["id"]
        return row["id"]

    def genre_id(self, slug: str) -> int | None:
        if slug not in self._genres:
            row = _first(self.db.table("genres").select("id").eq("slug", slug).limit(1).execute())
            if not row:
                return None
            self._genres[slug] = row["id"]
        return self._genres[slug]

    # ---------- links ----------
    def _similar_artist(self, name: str, artist_ids: set) -> dict | None:
        """Looks among the event's artists for another spelling of the same name
        ('Курган & Agregat' vs 'Курган і Agregat')."""
        for aid in artist_ids:
            row = _first(self.db.table("artists").select("id, name, aliases").eq("id", aid).limit(1).execute())
            if row and fuzz.ratio(_norm(row["name"]), _norm(name)) >= ARTIST_SIMILARITY:
                return row
        return None

    def link_artists(self, event_id: int, names: list[str]) -> None:
        existing = {r["artist_id"] for r in self.db.table("event_artists")
                    .select("artist_id").eq("event_id", event_id).execute().data}
        pos = len(existing)
        for name in names:
            same = self._similar_artist(name, existing) if existing else None
            if same:
                # same artist spelled differently: store it as an alias instead of a new artist
                if name != same["name"] and name not in (same.get("aliases") or []):
                    self.db.table("artists").update(
                        {"aliases": (same.get("aliases") or []) + [name]}).eq("id", same["id"]).execute()
                self._artists[slugify(name)] = same["id"]
                continue
            aid = self.artist_id(name)
            if aid not in existing:
                self.db.table("event_artists").insert(
                    {"event_id": event_id, "artist_id": aid, "position": pos}).execute()
                existing.add(aid)
                pos += 1

    def link_genres(self, event_id: int, slugs: list[str]) -> None:
        existing = {r["genre_id"] for r in self.db.table("event_genres")
                    .select("genre_id").eq("event_id", event_id).execute().data}
        for slug in slugs:
            gid = self.genre_id(slug)
            if gid and gid not in existing:
                self.db.table("event_genres").insert({"event_id": event_id, "genre_id": gid}).execute()
                existing.add(gid)

    def refresh_prices(self, event_id: int) -> None:
        """events.price_min/max = min/max across all sources; ticket_url = the cheapest one."""
        rows = self.db.table("event_sources").select("url, price_min, price_max") \
            .eq("event_id", event_id).execute().data
        if not rows:
            return
        mins = [r["price_min"] for r in rows if r.get("price_min") is not None]
        maxs = [r["price_max"] for r in rows if r.get("price_max") is not None]
        pmin = min(mins) if mins else None
        pmax = max(maxs) if maxs else None
        if pmin is not None and pmax is not None and pmax < pmin:
            pmax = pmin
        cheapest = min(rows, key=lambda r: (r.get("price_min") is None, r.get("price_min") or 0))
        self.db.table("events").update(
            {"price_min": pmin, "price_max": pmax, "ticket_url": cheapest["url"]}).eq("id", event_id).execute()

    def unique_event_slug(self, ev: ParsedEvent) -> str:
        base = f"{slugify(ev.title, 60)}-{ev.day}"
        slug, n = base, 2
        while _first(self.db.table("events").select("id").eq("slug", slug).limit(1).execute()):
            slug, n = f"{base}-{n}", n + 1
        return slug

    # ---------- main entry point ----------
    def save(self, ev: ParsedEvent) -> str:
        """Returns what happened: 'updated' | 'linked' | 'created'."""
        src = self.source_id(ev.source)
        source_row = {
            "url": ev.url,
            "price_min": ev.price_min,
            "price_max": ev.price_max,
            "raw": ev.raw,
        }

        # 2. this event from this site already exists: update it
        existing = _first(self.db.table("event_sources").select("id, event_id")
                          .eq("source_id", src).eq("external_id", ev.external_id).limit(1).execute())
        if existing:
            self.db.table("event_sources").update({**source_row, "last_seen_at": _now()}) \
                .eq("id", existing["id"]).execute()
            update = {"status": ev.status}
            if ev.ticket_status != "unknown":
                update["ticket_status"] = ev.ticket_status
            self.db.table("events").update(update).eq("id", existing["event_id"]).execute()
            self.refresh_prices(existing["event_id"])
            return "updated"

        venue = self.venue_id(ev.venue_name, ev.venue_address)

        # 3. the same event from another site: add only a new source
        dup = _first(self.db.rpc("find_duplicate_event", {
            "p_venue_id": venue,
            "p_starts_at": ev.starts_at.isoformat(),
            "p_title": ev.title,
            "p_is_all_day": ev.is_all_day,
        }).execute())
        if dup:
            event_id = dup["event_id"]
            self.db.table("event_sources").insert(
                {**source_row, "event_id": event_id, "source_id": src, "external_id": ev.external_id}).execute()
            self.link_artists(event_id, ev.artists)
            self.link_genres(event_id, ev.genres)
            self.refresh_prices(event_id)
            return "linked"

        # 4. a new event (the database sets first_seen_at itself, used for the "New" badge and alerts)
        event = _first(self.db.table("events").insert({
            "title": ev.title,
            "slug": self.unique_event_slug(ev),
            "description": ev.description,
            "category": ev.category,
            "status": ev.status,
            "starts_at": ev.starts_at.isoformat(),
            "ends_at": ev.ends_at.isoformat() if ev.ends_at else None,
            "is_all_day": ev.is_all_day,
            "venue_id": venue,
            "price_min": ev.price_min,
            "price_max": ev.price_max,
            "ticket_status": ev.ticket_status,
            "image_url": ev.image_url,
            "ticket_url": ev.url,
        }).execute())
        event_id = event["id"]
        self.db.table("event_sources").insert(
            {**source_row, "event_id": event_id, "source_id": src, "external_id": ev.external_id}).execute()
        self.link_artists(event_id, ev.artists)  # "I'm waiting for..." alerts depend on this
        self.link_genres(event_id, ev.genres)
        return "created"
