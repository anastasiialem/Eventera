"""Groups duplicates within a single run, for preview / JSON output only.

In the database, duplicates are found by the find_duplicate_event function
(same start time + similar title), so this file is not used when writing to the DB.
It applies the same rule so that the preview matches what ends up in the database.
"""
from __future__ import annotations

from rapidfuzz import fuzz

from .models import ParsedEvent

MIN_SIMILARITY = 70  # same as p_min_similarity = 0.7 in the database


def similarity(a: str, b: str) -> float:
    a, b = a.lower(), b.lower()
    return max(fuzz.ratio(a, b), fuzz.partial_ratio(a, b))


def same_event(a: ParsedEvent, b: ParsedEvent) -> bool:
    if a.is_all_day or b.is_all_day:
        same_time = a.day == b.day and a.venue_name.lower() == b.venue_name.lower()
    else:
        same_time = a.starts_at == b.starts_at
    return same_time and similarity(a.title, b.title) >= MIN_SIMILARITY


def dedupe(events: list[ParsedEvent]) -> list[list[ParsedEvent]]:
    """Returns groups; each group is one event coming from different sites."""
    groups: list[list[ParsedEvent]] = []
    for ev in events:
        for g in groups:
            if same_event(g[0], ev):
                g.append(ev)
                break
        else:
            groups.append([ev])
    return groups
