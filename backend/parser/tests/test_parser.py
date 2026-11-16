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

    from parser.normalize import names_after_colon
    assert names_after_colon("Розгони: Кудрява, Барило, Михайлова") == ["Кудрява", "Барило", "Михайлова"]
    assert names_after_colon("Стендап Шоу: Олег Та Степан") == ["Олег", "Степан"]
    assert names_after_colon("«Батя 2» Сольний Стендап Концерт") == []

def _ev(title, venue="Somewhere", type_="MusicEvent"):
    from parser.normalize import to_event
    obj = {"@type": type_, "name": title, "startDate": "2026-12-01T19:00:00+02:00",
           "location": {"name": venue}}
    return to_event(obj, "concert_ua")


def test_category_from_title():
    # Concert.ua marks everything as MusicEvent; the title decides
    assert (_ev("Батя 2. Сольний стендап концерт").category, _ev("Батя 2. Сольний стендап концерт").genres) \
        == ("other", ["standup"])
    assert _ev("Вистава «Обережно: жінки!»").category == "theatre"
    assert _ev("Танго на пуантах та Ближче ніж кохання").category == "opera"
    assert _ev("Georgian Royal Ballet").category == "opera"
    assert _ev("Bridal Forum").category == "other"
    assert _ev("ZWYNTAR у Львівській опері").category == "concert"         # 'опері' is a venue, not a genre
    assert _ev("Coldplay & Imagine Dragons при свічках").category == "concert"  # 'Dragons' is not 'drag'
    # comedy club: stand-up unless the title says it is a concert
    assert _ev("Шоу психотерапія: Білоцерковець, Трачук", "Довгі бурхливі оплески").genres == ["standup"]
    assert _ev("Концерт гурту DiZeX в Оплесках", "Довгі бурхливі оплески").category == "concert"


def test_title_with_pipes():
    from parser.normalize import split_title
    assert split_title("СУБОТНІЙ СТЕНДАП В ОПЛЕСКАХ | 21 ЛИСТОПАДА") == ("СУБОТНІЙ СТЕНДАП В ОПЛЕСКАХ", [])
    assert split_title("СТЕНДАП + НАКИДОНИ | ПРОНЮК, ОЗАРКІВ, БІЛОЦЕРКОВЕЦЬ | 22.11") \
        == ("СТЕНДАП + НАКИДОНИ", ["ПРОНЮК", "ОЗАРКІВ", "БІЛОЦЕРКОВЕЦЬ"])
    assert split_title("ПІД ПАЛИЧ | КОНЦЕРТ У ОПЛЕСКАХ | 2 ГРУДНЯ") == ("ПІД ПАЛИЧ", [])
    ev = _ev("ВЕЧІР ІСТОРІЙ В ОПЛЕСКАХ | БОРОВИЧ І КОЛІН | 21 ЛИСТОПАДА", "Довгі бурхливі оплески")
    assert ev.title == "ВЕЧІР ІСТОРІЙ В ОПЛЕСКАХ" and ev.artists == ["БОРОВИЧ", "КОЛІН"]
    # a quoted part is a show title, not a person
    assert _ev("Книгарня БУЕ: «Варвари Крижаної Планети»", "CULT Comedy Hall").artists == []


def test_venue_aliases():
    from parser.normalize import canonical_venue
    assert canonical_venue("Львівський національний академічний театр опери та балету") \
        == "Львівська національна опера"
    assert canonical_venue("Міський палац культури ім. Г. Хоткевича") == "Палац культури ім. Гната Хоткевича"
    assert canonical_venue("ТРЦ  VICTORIA GARDENS") == "ТРЦ VICTORIA GARDENS"


def test_concert_artists():
    from parser.normalize import concert_artists
    assert concert_artists("Концерт гурту DiZeX в Оплесках") == ["DiZeX"]
    assert concert_artists("Гурт BOYKY «Бойківське Різдво»") == ["BOYKY"]
    assert concert_artists("Гурт Скрябін. Про любов. НА БІС!") == ["Скрябін"]
    assert concert_artists("Благодійний Концерт «Baryk, Olsi, Linz»") == ["Baryk", "Olsi", "Linz"]
    assert concert_artists("ROMOZA концерт у Львові. Презентація альбому") == ["ROMOZA"]
    assert concert_artists("KADNAY з великим весняним концертом у Львові") == ["KADNAY"]
    assert concert_artists("ZWYNTAR у Львівській опері") == ["ZWYNTAR"]
    assert concert_artists("Степан Галябарда - «Живу. Люблю.І Вірую»") == ["Степан Галябарда"]
    assert concert_artists("Ілля Найда «Колядуємо Разом»") == ["Ілля Найда"]
    assert concert_artists("VICTORIA NIRO концерт у супроводі симфонічного оркестру") == ["VICTORIA NIRO"]
    # tributes and themed shows: nobody to follow
    assert concert_artists("Гра престолів при свічках") == []
    assert concert_artists("Eminem. Tribute Show у виконанні симфонічного оркестру") == []
    assert concert_artists("УКРАЇНСЬКІ РОК-ХІТИ У ВИКОНАННІ ОРКЕСТРУ") == []
    assert concert_artists("Різдво з Наталкою Карпою") == []
    assert concert_artists("Казковий мюзикл «Вкрадений час»") == []
    # open mic is a format, not a person
    assert _ev("Стендап: ОПЕНМАЙК", "CULT Comedy Hall").artists == []
