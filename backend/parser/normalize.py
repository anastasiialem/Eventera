"""Converts a schema.org event (from ld+json) into a ParsedEvent in the database format."""
from __future__ import annotations

import re
from datetime import datetime, time, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from .models import ParsedEvent

KYIV = ZoneInfo("Europe/Kyiv")
# Different spellings of the same venue -> one canonical name (keys in lowercase).
VENUE_ALIASES = {
    "театр імені марії заньковецької": "Театр ім. Марії Заньковецької",
    "національний драматичний театр імені марії заньковецької": "Театр ім. Марії Заньковецької",
}

def canonical_venue(name: str) -> str:
    return VENUE_ALIASES.get(name.strip().lower(), name.strip())

# --- event type -> category + genres -----------------------------------------
# The database has no "standup" category, so stand-up = other + the standup genre.
_OPERA_WORDS = re.compile(r"опер|балет|opera|ballet", re.IGNORECASE)


def category_and_genres(obj: dict, title: str, venue: str) -> tuple[str, list[str]]:
    t = obj.get("@type")
    t = t[0] if isinstance(t, list) and t else t
    if t == "ComedyEvent":
        return "other", ["standup"]
    if t == "Festival":
        return "festival", []
    if t == "ChildrensEvent":
        return "other", ["kids"]
    if t == "TheaterEvent":
        if _OPERA_WORDS.search(title) or _OPERA_WORDS.search(venue):
            return "opera", []
        return "theatre", []
    if t == "MusicEvent":
        return "concert", []
    return "other", []


# --- statuses ----------------------------------------------------------------
def ticket_status(offers) -> str:
    """schema.org availability -> unknown | available | few_left | sold_out."""
    if isinstance(offers, list):
        statuses = [ticket_status(o) for o in offers]
        for s in ("available", "few_left", "sold_out"):
            if s in statuses:
                return s
        return "unknown"
    a = str((offers or {}).get("availability", "")) if isinstance(offers, dict) else ""
    if "SoldOut" in a:
        return "sold_out"
    if "LimitedAvailability" in a:
        return "few_left"
    if any(x in a for x in ("InStock", "PreOrder", "OnlineOnly", "InStoreOnly")):
        return "available"
    return "unknown"


def event_status(obj: dict) -> str:
    s = str(obj.get("eventStatus", ""))
    if "Cancelled" in s:
        return "cancelled"
    if "Postponed" in s or "Rescheduled" in s:
        return "postponed"
    return "scheduled"


# --- prices ------------------------------------------------------------------
def _num(raw) -> Optional[float]:
    if raw is None or raw == "":
        return None
    try:
        return float(str(raw).replace(" ", "").replace(" ", "").replace(",", "."))
    except ValueError:
        return None


def prices(offers) -> tuple[Optional[float], Optional[float]]:
    """Returns (price_min, price_max). A price of 0 sets both to 0, so the DB marks is_free."""
    items = offers if isinstance(offers, list) else [offers]
    lows, highs = [], []
    for o in items:
        if not isinstance(o, dict):
            continue
        low = _num(o.get("lowPrice", o.get("price")))
        high = _num(o.get("highPrice"))
        if low is not None:
            lows.append(low)
        if high is not None:
            highs.append(high)
    pmin = min(lows) if lows else None
    pmax = max(highs) if highs else None
    if pmin == 0 and pmax is None:
        pmax = 0.0
    if pmax is not None and pmin is not None and pmax < pmin:
        pmax = pmin
    return pmin, pmax


# --- time --------------------------------------------------------------------
def parse_datetime(value: str) -> tuple[Optional[datetime], bool]:
    """Returns (timezone-aware datetime, is_all_day).
    '2026-12-05' without a time -> 00:00 Kyiv time and is_all_day = True."""
    if not value:
        return None, False
    value = value.strip().replace("Z", "+00:00")
    try:
        if "T" not in value and len(value) <= 10:
            d = datetime.fromisoformat(value).date()
            return datetime.combine(d, time(0, 0), KYIV), True
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None, False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=KYIV)  # no timezone given: assume Kyiv time
    return dt, False


def utc_clock_as_kyiv(dt: datetime) -> datetime:
    """Fix for sites that write Kyiv local time as if it were UTC.
    A 19:00 Kyiv show arrives as 21:00+02:00 (= 19:00 UTC); we turn it back into 19:00+02:00."""
    clock = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return clock.replace(tzinfo=KYIV)


# --- artist ------------------------------------------------------------------
# Suffixes sites append to titles that are not part of the artist's name
# (Ukrainian: "100% to the Armed Forces", "charity concert", "concert", "in Lviv", "Lviv").
_NOISE = re.compile(
    r"\s*[.,|–—-]?\s*(100\s*%\s*на\s*ЗСУ|благодійний концерт|концерт|у Львові|Львів)\s*$",
    re.IGNORECASE,
)


def clean_artist(title: str, performer: Optional[str] = None) -> str:
    """'Курган і Agregat. 100% на ЗСУ' -> 'Курган і Agregat'.
    A heuristic; tricky cases can later be handed to AI."""
    name = (performer or title or "").strip()
    name = re.split(r":\s|\.\s|\s[–—]\s", name, maxsplit=1)[0]
    for _ in range(2):
        name = _NOISE.sub("", name).strip()
    return name or (title or "").strip()

def names_after_colon(title: str) -> list[str]:
    """'Розгони: Кудрява, Барило, Михайлова' -> ['Кудрява', 'Барило', 'Михайлова'].
    Used for stand-up and shows, where the part before the colon is the show name."""
    if ":" not in title:
        return []
    tail = title.split(":", 1)[1]
    parts = re.split(r",|&|\s+та\s+|\s+і\s+", tail, flags=re.IGNORECASE)
    return [p.strip(" «»\"") for p in parts if p.strip(" «»\"")]

def _performers(obj: dict) -> list[str]:
    p = obj.get("performer")
    items = p if isinstance(p, list) else [p]
    return [str(x.get("name")).strip() for x in items if isinstance(x, dict) and x.get("name")]


# --- helpers -----------------------------------------------------------------
def _get(obj, *path, default=None):
    """Safely reads a nested field: _get(ev, "location", "name")."""
    for key in path:
        if isinstance(obj, list):
            obj = obj[0] if obj else None
        if not isinstance(obj, dict):
            return default
        obj = obj.get(key)
    return default if obj is None else obj


def _image(obj: dict) -> Optional[str]:
    img = obj.get("image")
    if isinstance(img, list):
        img = img[0] if img else None
    if isinstance(img, dict):
        img = img.get("url")
    return str(img) if img else None


def only_city(obj: dict, city: str = "Львів") -> bool:
    """True if the event is in the given city (or the city is not specified)."""
    locality = _get(obj, "location", "address", "addressLocality", default="")
    return not locality or city.lower() in str(locality).lower()


# --- main function -----------------------------------------------------------
def to_event(obj: dict, source: str, *, time_is_utc_clock: bool = False) -> Optional[ParsedEvent]:
    """schema.org dict -> ParsedEvent. Returns None if the title or date is missing.

    time_is_utc_clock=True is for sites that write Kyiv time as UTC (Karabas).
    """
    title = (obj.get("name") or "").strip()
    starts_at, all_day = parse_datetime(obj.get("startDate") or "")
    if not title or not starts_at:
        return None
    ends_at, _ = parse_datetime(obj.get("endDate") or "")
    if time_is_utc_clock and not all_day:
        starts_at = utc_clock_as_kyiv(starts_at)
        ends_at = utc_clock_as_kyiv(ends_at) if ends_at else None
    if ends_at and ends_at < starts_at:
        ends_at = None

    venue = canonical_venue(_get(obj, "location", "name") or "")
    street = (_get(obj, "location", "address", "streetAddress") or "").strip() or None
    category, genres = category_and_genres(obj, title, venue)

    performers = _performers(obj)
    artist = clean_artist(title, performers[0] if performers else None)
    artists = [artist] + [clean_artist(p) for p in performers[1:]]
    if category in ("theatre", "opera"):
        # for plays the title is not an artist; users follow them by keyword instead
        artists = [clean_artist(p) for p in performers if clean_artist(p) != title]

    if category == "other":
        # stand-up and shows: performers are listed after the colon, if at all
        artists = names_after_colon(title)

    url = (obj.get("url") or _get(obj, "offers", "url") or "").strip()
    offers = obj.get("offers")
    pmin, pmax = prices(offers)
    description = (obj.get("description") or "").strip() or None

    return ParsedEvent(
        title=title,
        category=category,
        starts_at=starts_at,
        ends_at=ends_at,
        is_all_day=all_day,
        status=event_status(obj),
        ticket_status=ticket_status(offers),
        price_min=pmin,
        price_max=pmax,
        description=description,
        image_url=_image(obj),
        venue_name=venue,
        venue_address=street,
        artists=[a for a in dict.fromkeys(artists) if a],
        genres=genres,
        source=source,
        external_id=url.split("?")[0],
        url=url,
        raw=obj,
    )
