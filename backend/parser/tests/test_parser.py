"""Offline tests: we parse saved snippets of real pages.
Run from the backend/ folder:  python -m pytest parser/tests

The data in fixtures/ is trimmed from the real pages (November 2026). The Kurgan
duplicate on Karabas, the test play and the stand-up show were added by hand to
exercise the logic.
"""
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from parser.dedupe import dedupe
from parser.normalize import clean_artist, parse_datetime, prices
from parser.slug import slugify
from parser.sources import concert_ua, karabas

FIX = Path(__file__).parent / "fixtures"
KYIV = ZoneInfo("Europe/Kyiv")


def load(name):
    return (FIX / name).read_text(encoding="utf-8")


def test_concert_ua_parse():
    events = concert_ua.parse(load("concert_ua.html"))
    # the Ivano-Frankivsk event is filtered out
    assert [e.title for e in events] == ["Курган і Agregat. 100% на ЗСУ", "OTOY"]
    k = events[0]
    assert k.source == "concert_ua"
    assert k.category == "concert"
    assert k.artists == ["Курган і Agregat"]
    assert k.starts_at == datetime(2026, 11, 27, 19, 0, tzinfo=KYIV)
    assert k.venue_name == "Event Hall на !FESTrepublic"
    assert (k.price_min, k.price_max) == (1190, None)
    assert k.ticket_status == "available"
    assert k.external_id == "https://concert.ua/uk/event/kurgan-i-agregat-lviv"
    assert events[1].ends_at == datetime(2026, 11, 20, 20, 30, tzinfo=KYIV)


def test_karabas_parse_and_time_fix():
    events = {e.title: e for e in karabas.parse(load("karabas.html"))}
    assert len(events) == 4
    max_b = events["MAX BARSKIH: Сьогодні має сенс"]
    assert max_b.starts_at == datetime(2026, 12, 2, 20, 0, tzinfo=KYIV)  # the site says "22:00+02:00"
    assert max_b.artists == ["MAX BARSKIH"]
    assert max_b.venue_address == "вул. Старознесенська, 24-26"
    play = events["Вистава «Тестова»"]
    assert play.category == "theatre" and play.artists == []  # for plays the title is not an artist
    standup = events["Стендап вечір"]
    assert (standup.category, standup.genres) == ("other", ["standup"])
    assert standup.ticket_status == "sold_out"
    assert (standup.price_min, standup.price_max) == (0, 0)  # -> is_free in the database


def test_same_event_from_two_sites_is_grouped():
    all_events = concert_ua.parse(load("concert_ua.html")) + karabas.parse(load("karabas.html"))
    groups = dedupe(all_events)
    assert len(all_events) == 6 and len(groups) == 5
    kurgan = next(g for g in groups if g[0].day == "2026-11-27")
    assert sorted(e.source for e in kurgan) == ["concert_ua", "karabas"]


def test_helpers():
    assert clean_artist("Курган і Agregat. 100% на ЗСУ") == "Курган і Agregat"
    assert clean_artist("x", "MAX BARSKIH: Сьогодні має сенс") == "MAX BARSKIH"
    assert clean_artist("Жадан і Собаки") == "Жадан і Собаки"
    assert slugify("Жадан і Собаки") == "zhadan-i-sobaky"
    assert slugify("Різдвяний ярмарок") == "rizdvianyi-iarmarok"
    dt, all_day = parse_datetime("2026-12-05")
    assert all_day and dt == datetime(2026, 12, 5, 0, 0, tzinfo=KYIV)
    assert prices([{"price": 300}, {"lowPrice": 200, "highPrice": 900}]) == (200, 900)
