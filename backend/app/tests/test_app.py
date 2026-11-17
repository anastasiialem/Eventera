"""Тести без інтернету: Supabase підмінено словником у пам'яті.

    cd backend && python -m pytest app/tests
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone

import httpx

from app import notify
from app.supabase import Supabase
from app.telegram_links import LinkResult, create_link_token, link_chat, unlink_chat


class FakePostgrest:
    """Дуже спрощений PostgREST: eq.-фільтри, insert/upsert, delete."""

    def __init__(self, tables: dict[str, list[dict]]):
        self.tables = tables

    def _match(self, row: dict, params) -> bool:
        for k, v in params.items():
            if k in ("select", "limit", "on_conflict", "order"):
                continue
            if str(row.get(k)) != v.removeprefix("eq."):
                return False
        return True

    def __call__(self, request: httpx.Request) -> httpx.Response:
        table = request.url.path.rsplit("/", 1)[-1]
        rows = self.tables.setdefault(table, [])
        params = dict(request.url.params)
        if request.method == "GET":
            return httpx.Response(200, json=[r for r in rows if self._match(r, params)])
        if request.method == "PATCH":
            for r in rows:
                if self._match(r, params):
                    r.update(json.loads(request.content))
            return httpx.Response(204)
        if request.method == "DELETE":
            self.tables[table] = [r for r in rows if not self._match(r, params)]
            return httpx.Response(204)
        if request.method == "POST":
            body = json.loads(request.content)
            new = body if isinstance(body, list) else [body]
            key = params.get("on_conflict")
            stored = []
            for row in new:
                row = dict(row)
                if table == "telegram_link_tokens":
                    row.setdefault("token", f"tok{len(rows) + 1}")
                    row.setdefault("expires_at", (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat())
                if key:
                    self.tables[table] = rows = [r for r in rows if r.get(key) != row.get(key)]
                rows.append(row)
                stored.append(row)
            return httpx.Response(201, json=stored if "representation" in request.headers.get("prefer", "") else [])
        return httpx.Response(405)


def make_db(tables):
    fake = FakePostgrest(tables)
    return Supabase("https://x.supabase.co", "sb_secret_test", transport=httpx.MockTransport(fake)), fake


def run(coro):
    return asyncio.run(coro)


def test_link_flow_single_use_and_relink():
    db, fake = make_db({"telegram_link_tokens": [], "telegram_links": []})
    token = run(create_link_token(db, "user-1"))
    assert run(link_chat(db, token, 555, "anna")) is LinkResult.LINKED
    assert fake.tables["telegram_links"] == [{"user_id": "user-1", "chat_id": 555, "username": "anna"}]
    # токен одноразовий
    assert run(link_chat(db, token, 555, "anna")) is LinkResult.INVALID
    # той самий чат прив'язують до іншого акаунта — старий зв'язок прибирається
    token2 = run(create_link_token(db, "user-2"))
    assert run(link_chat(db, token2, 555, "anna")) is LinkResult.LINKED
    assert fake.tables["telegram_links"] == [{"user_id": "user-2", "chat_id": 555, "username": "anna"}]
    run(unlink_chat(db, 555))
    assert fake.tables["telegram_links"] == []


def test_expired_token():
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    db, fake = make_db({"telegram_link_tokens": [{"token": "old", "user_id": "u", "expires_at": past}],
                        "telegram_links": []})
    assert run(link_chat(db, "old", 1, None)) is LinkResult.EXPIRED
    assert fake.tables["telegram_links"] == []


def test_format_when_uses_kyiv_time():
    assert notify.format_when("2026-11-21T17:00:00+00:00") == "сб, 21 листопада, 19:00"


def test_notify_sends_records_and_unlinks_blocked():
    row = {"user_id": "u1", "event_id": 7, "channel": "telegram", "address": "555",
           "title": "Jerry Heil <live>", "starts_at": "2026-11-25T17:00:00+00:00",
           "ticket_url": "https://t.example/7", "venue_name": "Арена «Малевич»"}
    blocked = {**row, "user_id": "u2", "address": "777"}
    db, fake = make_db({
        "notification_queue": [row, blocked],
        "reminder_queue": [],
        "notifications_sent": [],
        "telegram_links": [{"user_id": "u2", "chat_id": 777}],
    })
    sent = []

    async def sender(msg: notify.Message) -> bool:
        if msg.chat_id == 777:
            return False          # заблокував бота
        sent.append(msg)
        return True

    stats = run(notify.run(db, sender, "https://eventera.example"))
    assert stats["notification_queue"].sent == 1 and stats["notification_queue"].blocked == 1
    assert "Jerry Heil &lt;live&gt;" in sent[0].text and "ср, 25 листопада, 19:00" in sent[0].text
    assert sent[0].event_url == "https://eventera.example/event/7"
    assert fake.tables["notifications_sent"] == [
        {"user_id": "u1", "event_id": 7, "channel": "telegram", "kind": "new_event"}]
    assert fake.tables["telegram_links"] == []


def test_is_vip():
    from app.waitlist import is_vip
    now = datetime(2026, 11, 17, 12, tzinfo=timezone.utc)
    assert not is_vip({"vip_until": None}, now)
    assert not is_vip({}, now)
    assert not is_vip({"vip_until": "2026-11-17T11:59:59+00:00"}, now)
    assert is_vip({"vip_until": "2026-12-17T12:00:00.123456+00:00"}, now)


def test_format_date():
    assert notify.format_date("2026-12-16T23:30:00+00:00") == "17 грудня"


def test_vip_extend_keeps_remaining_days():
    from app.vip import extend
    now = datetime(2026, 11, 17, tzinfo=timezone.utc)
    assert extend(None, now) == now + timedelta(days=30)
    assert extend("2026-11-01T00:00:00+00:00", now) == now + timedelta(days=30)        # минув — від сьогодні
    assert extend("2026-11-27T00:00:00+00:00", now) == datetime(2026, 12, 27, tzinfo=timezone.utc)


def test_vip_approve_and_reject():
    from app import vip
    db, fake = make_db({
        "vip_requests": [{"id": 1, "user_id": "u1", "email": "a@x.ua", "status": "pending"},
                         {"id": 2, "user_id": "u1", "email": "a@x.ua", "status": "pending"},
                         {"id": 3, "user_id": "u2", "email": "b@x.ua", "status": "pending"}],
        "profiles": [{"id": "u1", "vip_until": None}, {"id": "u2", "vip_until": None}],
    })
    now = datetime(2026, 11, 17, tzinfo=timezone.utc)
    d = run(vip.approve(db, 1, now))
    assert d.user_id == "u1" and d.vip_until == now + timedelta(days=30)
    assert fake.tables["profiles"][0]["vip_until"] == (now + timedelta(days=30)).isoformat()
    assert [r["status"] for r in fake.tables["vip_requests"]] == ["approved", "approved", "pending"]
    assert run(vip.approve(db, 2, now)) is None            # уже оброблено
    assert run(vip.reject(db, 3)).email == "b@x.ua"
    assert fake.tables["vip_requests"][2]["status"] == "rejected"
    assert fake.tables["profiles"][1]["vip_until"] is None


def test_normalize_ignores_quotes_and_case():
    from app.waitlist import normalize
    assert normalize("Вистава «Крик кохання»!") == "вистава крик кохання"
    assert "вистава крик кохання" in normalize("ВИСТАВА  \"Крик—кохання\"")


def test_add_keyword_dedupes_case_and_quotes():
    from app.waitlist import add_keyword
    db, fake = make_db({"subscriptions": [{"user_id": "u1", "kind": "keyword", "keyword": "Вистава Крик кохання"}]})
    assert run(add_keyword(db, "u1", "вистава «Крик Кохання»")).ok is False
    assert run(add_keyword(db, "u1", "Скрябін")).ok is True
    assert len(fake.tables["subscriptions"]) == 2
