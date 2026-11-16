"""A single event from a single site, with fields that match the database tables
(supabase/migrations/20261116120000_events_schema.sql)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

# Values accepted by the database (enums in the migration). Nothing else is allowed.
CATEGORIES = ("concert", "theatre", "festival", "opera", "other")
TICKET_STATUSES = ("unknown", "available", "few_left", "sold_out")
EVENT_STATUSES = ("scheduled", "postponed", "cancelled")


@dataclass
class ParsedEvent:
    # --- events ---
    title: str                                # title as shown on the site
    category: str                             # one of CATEGORIES
    starts_at: datetime                       # always timezone-aware
    ends_at: Optional[datetime] = None
    is_all_day: bool = False                  # all-day events (fairs, festivals)
    status: str = "scheduled"                 # one of EVENT_STATUSES
    ticket_status: str = "unknown"            # one of TICKET_STATUSES
    price_min: Optional[float] = None         # UAH
    price_max: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None

    # --- venues ---
    venue_name: str = ""
    venue_address: Optional[str] = None

    # --- artists / event_artists (first one = headliner) ---
    artists: list[str] = field(default_factory=list)

    # --- genres / event_genres (slugs from the genres table) ---
    genres: list[str] = field(default_factory=list)

    # --- event_sources ---
    source: str = ""                          # code from the sources table: concert_ua | karabas
    external_id: str = ""                     # event id on the source site (we use its URL)
    url: str = ""                             # ticket link on this site
    raw: Optional[dict] = None                # raw data (for the AI extractor / debugging)

    @property
    def day(self) -> str:
        return self.starts_at.date().isoformat()

    def to_dict(self) -> dict:
        d = dict(self.__dict__)
        d["starts_at"] = self.starts_at.isoformat()
        d["ends_at"] = self.ends_at.isoformat() if self.ends_at else None
        d.pop("raw", None)
        return d
