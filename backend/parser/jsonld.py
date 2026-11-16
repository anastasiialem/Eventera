"""Extracts ready-made event data from HTML (<script type="application/ld+json"> blocks).

Concert.ua and Karabas embed schema.org blocks of type MusicEvent / TheaterEvent /
ComedyEvent in their listing pages, already containing title, date, venue and price.
"""
from __future__ import annotations

import json

from bs4 import BeautifulSoup

EVENT_TYPES = {"Event", "MusicEvent", "TheaterEvent", "ComedyEvent", "Festival",
               "DanceEvent", "ChildrensEvent", "LiteraryEvent", "SocialEvent"}


def _flatten(obj):
    """A block can be a single object, a list, or contain @graph; unwrap all of them."""
    if isinstance(obj, list):
        for item in obj:
            yield from _flatten(item)
    elif isinstance(obj, dict):
        if "@graph" in obj:
            yield from _flatten(obj["@graph"])
        else:
            yield obj


def _is_event(obj: dict) -> bool:
    t = obj.get("@type")
    types = t if isinstance(t, list) else [t]
    return any(x in EVENT_TYPES for x in types if isinstance(x, str))


def extract_events(html: str) -> list[dict]:
    """Returns every schema.org event on the page as a dict."""
    soup = BeautifulSoup(html, "lxml")
    events: list[dict] = []
    for tag in soup.find_all("script", type="application/ld+json"):
        text = tag.string or tag.get_text() or ""
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue  # malformed block, skip it
        events.extend(o for o in _flatten(data) if _is_event(o))
    return events
