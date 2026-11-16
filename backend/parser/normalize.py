"""Converts a schema.org event (from ld+json) into a ParsedEvent in the database format."""
from __future__ import annotations

import re
from datetime import datetime, time, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from .models import ParsedEvent

KYIV = ZoneInfo("Europe/Kyiv")

# --- venues ------------------------------------------------------------------
# Different spellings of the same venue -> one canonical name (keys in lowercase).
# When a new duplicate venue shows up in the output, add a line here.
VENUE_ALIASES = {
    "театр імені марії заньковецької": "Театр ім. Марії Заньковецької",
    "національний драматичний театр імені марії заньковецької": "Театр ім. Марії Заньковецької",
    "львівський національний академічний театр опери та балету": "Львівська національна опера",
    "львівський національний академічний театр опери та балету імені соломії крушельницької":
        "Львівська національна опера",
    "міський палац культури ім. г. хоткевича": "Палац культури ім. Гната Хоткевича",
    "палац культури ім. г. хоткевича": "Палац культури ім. Гната Хоткевича",
    "палац мистецтв": "Львівський палац мистецтв",
}

# Comedy clubs: anything there that is not explicitly a concert is stand-up.
COMEDY_VENUES = {"довгі бурхливі оплески", "cult comedy hall"}


def canonical_venue(name: str) -> str:
    name = " ".join(name.split())  # collapse double spaces
    return VENUE_ALIASES.get(name.lower(), name)


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


# Concert.ua marks almost everything as MusicEvent, so the title has the final say.
_STANDUP_WORDS = re.compile(
    r"стендап|stand[\s-]?up|розгони|накидони|імпровізац|опенмайк|open[\s-]?mic", re.IGNORECASE)
_PLAY_WORDS = re.compile(r"\bвистав|\bспектакл", re.IGNORECASE)
_BALLET_WORDS = re.compile(r"балет|ballet|пуант|\bопера\b|\bopera\b", re.IGNORECASE)
_NOT_A_SHOW_WORDS = re.compile(
    r"форум|forum|ярмарок|vintage|маркет|market|виставк|drag\s*queen|льодов", re.IGNORECASE)
_CONCERT_WORDS = re.compile(r"концерт|гурт|оркестр|symphony|симфон", re.IGNORECASE)


def refine_category(category: str, genres: list[str], title: str, venue: str) -> tuple[str, list[str]]:
    """Corrects the category using words in the title and the venue."""
    if "standup" in genres:
        return category, genres
    is_comedy_venue = venue.lower() in COMEDY_VENUES
    if _STANDUP_WORDS.search(title) or (is_comedy_venue and not _CONCERT_WORDS.search(title)):
        return "other", ["standup"]
    if _BALLET_WORDS.search(title):
        return "opera", genres
    if _PLAY_WORDS.search(title):
        return "theatre", genres
    if _NOT_A_SHOW_WORDS.search(title):
        return "other", genres
    return category, genres


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
    name = re.split(r":\s|\.\s|\s[–—-]\s", name, maxsplit=1)[0]
    if "«" in name and not name.startswith("«"):
        name = name.split("«", 1)[0]  # 'Ілля Найда «Колядуємо Разом»' -> 'Ілля Найда'
    name = _AFTER_NAME.split(name, maxsplit=1)[0]
    for _ in range(2):
        name = _NOISE.sub("", name).strip()
    return name or (title or "").strip()


# Words that end the artist's name: 'ROMOZA концерт у Львові', 'KADNAY з великим весняним концертом',
# 'EPOLETS презентація вінілу'
_AFTER_NAME = re.compile(
    r"\s+(?:з\s+(?:\S+\s+){0,3}концерт\w*|концерт\w*|презентац\w*|вперше\b|у\s+львів\w*)",
    re.IGNORECASE)
# Tributes and themed shows have no artist to follow (checked on the full title).
_TRIBUTE = re.compile(
    r"при свічках|candlelight|tribute|трибют|у виконанні|symphony|оркестр|music of|музика\s|хіти|хітів",
    re.IGNORECASE)
# A candidate that is a show format or a season, not a person or a band.
_NOT_AN_ARTIST = re.compile(
    r"опенмайк|open[\s-]?mic|стендап|накидони|шоу|show|party|паті|мюзикл|казк|пригоди|"
    r"різдв|новорічн|пісня|forum|форум|фестивал|festival|ярмарок",
    re.IGNORECASE)
# 'Концерт гурту DiZeX в Оплесках', 'Гурт BOYKY «Бойківське Різдво»'
_BAND = re.compile(r"(?:^|\s)(?:гурту|гурт|гурта|групи)\s+(.+)", re.IGNORECASE)


def concert_artists(title: str, performer: Optional[str] = None) -> list[str]:
    """Artists of a concert, from the performer field or the title."""
    text = (performer or title).strip()
    if _TRIBUTE.search(title) and not re.search(r"у супроводі", title, re.IGNORECASE):
        return []  # 'Гра престолів при свічках', 'Eminem. Tribute Show'
    band = _BAND.search(text)
    if band:
        name = re.split(r"\s+(?:в|у)\s+|\.\s|«", band.group(1), maxsplit=1)[0].strip()
        return [name] if name else []
    quoted = re.search(r"«([^»]*,[^»]*)»", text)
    if quoted:  # 'Благодійний Концерт «Baryk, Olsi, Linz»'
        return split_names(quoted.group(1))
    name = clean_artist(title, performer)
    if not name or _NOT_AN_ARTIST.search(name):
        return []
    return [name]


def split_names(text: str) -> list[str]:
    """'Кудрява, Барило та Скорик' -> ['Кудрява', 'Барило', 'Скорик']."""
    parts = [p.strip() for p in re.split(r",|&|\s+та\s+|\s+і\s+", text, flags=re.IGNORECASE)]
    # a part in quotes is a show title («Варвари Крижаної Планети»), not a person
    return [p.strip("\"") for p in parts if p and not p.startswith(("«", "\"", "'"))]


def names_after_colon(title: str) -> list[str]:
    """'Розгони: Кудрява, Барило, Михайлова' -> ['Кудрява', 'Барило', 'Михайлова'].
    Used for stand-up and shows, where the part before the colon is the show name."""
    if ":" not in title:
        return []
    return split_names(title.split(":", 1)[1])


# A segment that is only a date: '21 ЛИСТОПАДА', '22.11', '2 грудня 2026'
_DATE_SEGMENT = re.compile(
    r"^\d{1,2}([./]\d{1,2}([./]\d{2,4})?|\s+(січ|лют|бер|квіт|трав|черв|лип|серп|вер|жовт|лист|груд)\w*(\s+\d{4})?)$",
    re.IGNORECASE)
# A segment that describes the show rather than listing people
_GENERIC_SEGMENT = re.compile(r"концерт|шоу|стендап|вечір|оплеск|\bтур\b|презентац", re.IGNORECASE)


def split_title(title: str) -> tuple[str, list[str]]:
    """Concert.ua packs extra info into titles with ' | ':
    'СТЕНДАП + НАКИДОНИ | ПРОНЮК, ОЗАРКІВ | 22.11' -> ('СТЕНДАП + НАКИДОНИ', ['ПРОНЮК', 'ОЗАРКІВ']).
    Date segments are dropped, segments with names are returned as performers."""
    parts = [p.strip() for p in title.split("|") if p.strip()]
    if len(parts) < 2:
        return title.strip(), []
    names: list[str] = []
    for part in parts[1:]:
        if _DATE_SEGMENT.match(part) or _GENERIC_SEGMENT.search(part):
            continue
        names.extend(split_names(part))
    return parts[0], names


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
    full_title = (obj.get("name") or "").strip()
    title, title_names = split_title(full_title)
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
    category, genres = refine_category(category, genres, full_title, venue)

    performers = _performers(obj)
    artists = concert_artists(title, performers[0] if performers else None)
    artists += [a for p in performers[1:] for a in concert_artists(p)]
    if category in ("theatre", "opera"):
        # for plays the title is not an artist; users follow them by keyword instead
        artists = [clean_artist(p) for p in performers if clean_artist(p) != title]

    if category == "other":
        # stand-up and shows: performers are listed after the colon or between '|', if at all
        artists = [n for n in (title_names or names_after_colon(title)) if not _NOT_AN_ARTIST.search(n)]

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
