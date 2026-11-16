"""Concert.ua: Lviv listings.

The catalog page contains an ld+json block of type MusicEvent for every event.
"""
from __future__ import annotations

from ..fetch import get_html
from ..jsonld import extract_events
from ..models import ParsedEvent
from ..normalize import only_city, to_event

SOURCE = "concert_ua"  # code from the sources table
CATALOG_URL = "https://concert.ua/uk/catalog/lviv/all-categories"


def parse(html: str) -> list[ParsedEvent]:
    """Parses the catalog page HTML. Makes no network requests, so it is easy to test."""
    events, seen = [], set()
    for obj in extract_events(html):
        if not only_city(obj):
            continue
        ev = to_event(obj, SOURCE)
        if ev and ev.external_id not in seen:
            seen.add(ev.external_id)
            events.append(ev)
    return events


def fetch(url: str = CATALOG_URL) -> list[ParsedEvent]:
    """Downloads the catalog and returns its events.

    TODO: the catalog shows ~20 events. Find out how the next page is loaded
    (a ?page=2 parameter or a "Show more" button) and walk through all pages.
    """
    return parse(get_html(url))
