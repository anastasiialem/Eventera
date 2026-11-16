"""Tests database writes against an in-memory fake database (no Supabase, no internet).

FakeClient supports exactly the calls db.py makes: table().select/insert/update,
eq, contains, limit, execute, and rpc("find_duplicate_event").
"""
from datetime import datetime
from pathlib import Path

from rapidfuzz import fuzz

from parser.db import EventWriter
from parser.sources import concert_ua, karabas

FIX = Path(__file__).parent / "fixtures"


class Resp:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op, self.payload, self.n = db, table, [], "select", None, None

    def select(self, *_):
        self.op = "select"
        return self

    def insert(self, row):
        self.op, self.payload = "insert", row
        return self

    def update(self, row):
        self.op, self.payload = "update", row
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def contains(self, col, vals):
        self.filters.append(lambda r: all(v in (r.get(col) or []) for v in vals))
        return self

    def limit(self, n):
        self.n = n
        return self

    def _rows(self):
        return [r for r in self.db.tables[self.table] if all(f(r) for f in self.filters)]

    def execute(self):
        rows = self.db.tables[self.table]
        if self.op == "insert":
            row = dict(self.payload)
            if self.table not in ("event_artists", "event_genres"):
                row["id"] = len(rows) + 1
            rows.append(row)
            return Resp([row])
        found = self._rows()
        if self.op == "update":
            for r in found:
                r.update(self.payload)
            return Resp(found)
        return Resp(found[: self.n] if self.n else found)


class RpcCall:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return Resp(self.data)


class FakeClient:
    def __init__(self):
        self.tables = {t: [] for t in ("sources", "venues", "artists", "genres", "events",
                                       "event_sources", "event_artists", "event_genres")}
        self.tables["sources"] = [{"id": 1, "code": "karabas"}, {"id": 2, "code": "concert_ua"}]
        self.tables["genres"] = [{"id": 15, "slug": "standup"}]
        self.tables["artists"] = [{"id": 1, "name": "Жадан і Собаки", "slug": "zhadan-i-sobaky",
                                   "aliases": ["Zhadan i Sobaky"]}]

    def table(self, name):
        return Query(self, name)

    def rpc(self, name, p):
        """A simplified copy of find_duplicate_event: same start time + similar title."""
        assert name == "find_duplicate_event"
        start = datetime.fromisoformat(p["p_starts_at"])
        hits = [{"event_id": e["id"], "title": e["title"]} for e in self.tables["events"]
                if datetime.fromisoformat(e["starts_at"]) == start
                and fuzz.partial_ratio(e["title"].lower(), p["p_title"].lower()) >= 70]
        return RpcCall(hits)


def test_save_flow():
    db = FakeClient()
    w = EventWriter(db)
    cu = concert_ua.parse((FIX / "concert_ua.html").read_text(encoding="utf-8"))
    kb = karabas.parse((FIX / "karabas.html").read_text(encoding="utf-8"))

    assert [w.save(e) for e in cu] == ["created", "created"]
    results = [w.save(e) for e in kb]
    assert results.count("linked") == 1        # Kurgan from Karabas merged with Concert.ua
    assert results.count("created") == 3

    kurgan = next(e for e in db.tables["events"] if e["title"].startswith("Курган"))
    sources = [s for s in db.tables["event_sources"] if s["event_id"] == kurgan["id"]]
    assert len(sources) == 2
    assert kurgan["price_min"] == 990          # the cheaper of the two sites
    assert kurgan["ticket_url"] == "https://lviv.karabas.com/kurgan-agregat/"
    assert kurgan["slug"] == "kurhan-i-agregat-100-na-zsu-2026-11-27"
    links = [a for a in db.tables["event_artists"] if a["event_id"] == kurgan["id"]]
    assert len(links) == 1                     # one artist, not two different spellings
    artist = next(a for a in db.tables["artists"] if a["id"] == links[0]["artist_id"])
    assert artist["name"] == "Курган і Agregat"
    assert artist["aliases"] == ["Курган & Agregat"]

    standup = next(e for e in db.tables["events"] if e["title"] == "Стендап вечір")
    assert {"event_id": standup["id"], "genre_id": 15} in db.tables["event_genres"]

    # a second run: nothing new, only updates
    assert set(w.save(e) for e in cu + kb) == {"updated"}
    assert len(db.tables["events"]) == 5


def test_alias_match():
    db = FakeClient()
    w = EventWriter(db)
    assert w.artist_id("Zhadan i Sobaky") == 1   # found through aliases, no new artist created
    assert len(db.tables["artists"]) == 1
