# Lviv events parser

Collects concerts, plays and stand-up shows from **Concert.ua** and **Karabas** and
writes them to Supabase using the schema in `supabase/migrations/`. The same event
found on two sites becomes one event with two sources (`event_sources`).

## How to run

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # once
pip install -r parser/requirements.txt                 # once
cp .env.example .env                                   # once, then fill in the keys

python -m parser.run                   # just preview what was found
python -m parser.run --json out.json   # save to a file
python -m parser.run --db              # write to Supabase
python -m pytest parser/tests          # tests (no internet, no database)
```

`--db` needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`
(Supabase -> Project Settings -> API). The `service_role` key belongs only on the
server and in GitHub Secrets, never in git and never in the frontend.

## How it works

| File | What it does |
|---|---|
| `sources/concert_ua.py`, `sources/karabas.py` | one source each: download the page -> list of events |
| `jsonld.py` | extracts ready-made schema.org blocks (`application/ld+json`) from HTML |
| `normalize.py` | turns them into `ParsedEvent`: category, time, prices, statuses, artists |
| `models.py` | `ParsedEvent`, whose fields match the database tables |
| `db.py` | writes to the database following the algorithm in `supabase/README.md` |
| `dedupe.py` | groups duplicates for the preview only (the database uses `find_duplicate_event`) |
| `slug.py` | Latin `slug` values |
| `run.py` | entry point |

### Site quirks

- **Karabas writes Kyiv time as UTC** (19:00 -> `21:00+02:00`). This is fixed in
  `sources/karabas.py` (`TIME_IS_UTC_CLOCK = True`); without it, events would not merge with Concert.ua.
- The database has no "stand-up" category, so these events are stored as `other` + the `standup` genre.
- For plays the title is not an artist, so their `event_artists` stay empty
  ("I'm waiting for..." works for plays through a `keyword` subscription).
- A different spelling of an artist from another site ("Курган & Agregat") is added to `artists.aliases`.
- **Concert.ua marks almost everything as `MusicEvent`**, so `refine_category` in `normalize.py`
  corrects the category from words in the title (stand-up, play, ballet, forum, ...) and the venue
  (comedy clubs in `COMEDY_VENUES`).
- Concert.ua puts dates and names into titles with `|` ("... | ПРОНЮК, ОЗАРКІВ | 22.11"):
  `split_title` drops the date and turns the names into artists.
- The same venue spelled differently is mapped to one name in `VENUE_ALIASES` (`normalize.py`).
  Add a line there whenever a new duplicate venue shows up in the output.

## Re-importing from scratch

A re-run only updates prices and statuses; it does not change the category, title or artists
of events that are already in the database. After changing the parsing rules, clear the parsed
data in the Supabase SQL Editor and run `python -m parser.run --db` again:

```sql
-- WARNING: also deletes subscriptions and sent notifications that point to these events/artists
truncate public.event_sources, public.event_artists, public.event_genres,
         public.events, public.artists, public.venues
restart identity cascade;
```

Do this only while there are no real users.

## Next steps

- [x] tested on the real sites (~140 records -> ~130 events)
- [x] Concert.ua pagination
- [x] scheduled runs: `.github/workflows/parser.yml`, every hour at :50, before the
      Telegram notifications at :15. Needs repository secrets `SUPABASE_URL` and
      `SUPABASE_SERVICE_ROLE_KEY`; run it by hand with Actions -> Parser -> Run workflow.
      A run fails (red) if no events were collected or none could be saved.
- [ ] a theatre site + AI extraction from plain text (needs a migration adding its code to `sources`)
- [ ] AI for tricky artist names and genres
