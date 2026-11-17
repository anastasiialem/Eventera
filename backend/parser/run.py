"""Running the parser (from the backend/ folder):

    python -m parser.run                  # just preview what was found
    python -m parser.run --json out.json  # save to a file
    python -m parser.run --db             # write to Supabase (needs backend/.env)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .dedupe import dedupe
from .sources import concert_ua, karabas

SOURCES = [concert_ua, karabas]  # add the theatre source here later


def selected_sources() -> list:
    """All sources, or only those listed in PARSER_SOURCES (e.g. "karabas").
    GitHub Actions sets it because Concert.ua blocks GitHub's servers with 403."""
    wanted = os.environ.get("PARSER_SOURCES", "").replace(" ", "")
    if not wanted:
        return SOURCES
    names = set(wanted.split(","))
    unknown = names - {s.SOURCE for s in SOURCES}
    if unknown:
        sys.exit(f"Unknown source(s) in PARSER_SOURCES: {', '.join(sorted(unknown))}")
    return [s for s in SOURCES if s.SOURCE in names]


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def collect() -> list:
    events = []
    for src in selected_sources():
        try:
            found = src.fetch()
            log(f"{src.SOURCE}: found {len(found)} events")
            if not found:
                log(f"  ! {src.SOURCE}: 0 events; the site may load data with JavaScript "
                    f"(then we need playwright) or its page has changed")
            events.extend(found)
        except Exception as e:  # one failing source does not stop the others
            log(f"{src.SOURCE}: error: {e}")
    events.sort(key=lambda e: e.starts_at)
    return events


def print_table(events) -> None:
    groups = dedupe(events)
    for g in groups:
        e = g[0]
        when = "all day" if e.is_all_day else e.starts_at.strftime("%H:%M")
        price = f"from {e.price_min:.0f} UAH" if e.price_min is not None else "price ?"
        sources = ", ".join(x.source for x in g)
        print(f"{e.day} {when:7} | {e.category:8} | {e.title} | {e.venue_name} | {price} | {sources}")
    log(f"Total: {len(events)} records from sites -> {len(groups)} events after removing duplicates")


def save_to_db(events) -> None:
    from dotenv import load_dotenv

    from .db import EventWriter, connect

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")  # backend/.env
    writer = EventWriter(connect())
    stats = {"created": 0, "linked": 0, "updated": 0, "error": 0}
    for ev in events:
        try:
            stats[writer.save(ev)] += 1
        except Exception as e:  # one bad event does not stop the rest
            stats["error"] += 1
            log(f"  ! not saved: '{ev.title}' ({ev.source}): {e}")
    log(f"Database: {stats['created']} new, {stats['linked']} merged with another site, "
        f"{stats['updated']} updated, {stats['error']} errors")
    if events and stats["error"] == len(events):
        sys.exit("Every event failed to save: check the Supabase keys and the schema")


def main() -> None:
    ap = argparse.ArgumentParser(description="Lviv events parser")
    ap.add_argument("--json", metavar="FILE", help="save events to a JSON file")
    ap.add_argument("--db", action="store_true", help="write events to Supabase")
    args = ap.parse_args()

    events = collect()
    print_table(events)
    if not events:
        # all sources failed or returned nothing: fail loudly so a scheduled run shows up red
        sys.exit("No events collected from any source")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump([e.to_dict() for e in events], f, ensure_ascii=False, indent=2)
        log(f"Saved to {args.json}")
    if args.db:
        save_to_db(events)


if __name__ == "__main__":
    main()
