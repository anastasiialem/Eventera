"""Karabas: Lviv listings.

The lviv.karabas.com home page contains ld+json blocks: MusicEvent, TheaterEvent,
ComedyEvent. Unlike Concert.ua, it also has performer and the full address.

Note (see supabase/README.md): Karabas writes Kyiv time as UTC, so a 19:00 show
appears as "21:00+02:00". That is why time_is_utc_clock is on; otherwise events
would not merge with other sites (duplicates are matched on the exact start time).
"""
from __future__ import annotations

from ..fetch import get_html
from ..jsonld import extract_events
from ..models import ParsedEvent
from ..normalize import only_city, to_event

SOURCE = "karabas"  # code from the sources table
CATALOG_URL = "https://lviv.karabas.com/"
TIME_IS_UTC_CLOCK = True  # set to False if Karabas fixes the times on its site


def parse(html: str) -> list[ParsedEvent]:
    events, seen = [], set()
    for obj in extract_events(html):
        if not only_city(obj):
            continue
        ev = to_event(obj, SOURCE, time_is_utc_clock=TIME_IS_UTC_CLOCK)
        if ev and ev.external_id not in seen:  # an event can appear twice on the home page
            seen.add(ev.external_id)
            events.append(ev)
    return events


def fetch(url: str = CATALOG_URL) -> list[ParsedEvent]:
    """TODO: check whether the home page lists every event or whether we need to walk
    the sections (concerts / theatre / stand-up)."""
    return parse(get_html(url))
