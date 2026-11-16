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


def fetch(url: str = CATALOG_URL, max_pages: int = 20) -> list[ParsedEvent]:
    """Downloads catalog pages one by one until a page brings no new events."""
    events, seen = [], set()
    for page in range(1, max_pages + 1):
        page_url = url if page == 1 else f"{url}?page={page}"
        try:
            found = parse(get_html(page_url))
        except Exception:
            if page == 1:
                raise  # the catalog itself failed: show the real error
            break  # page does not exist
        new = [e for e in found if e.external_id not in seen]
        if not new:
            break  # the site repeats the last page, so we are done
        seen.update(e.external_id for e in new)
        events.extend(new)
    return events
