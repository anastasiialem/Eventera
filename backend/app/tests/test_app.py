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
            if k in ("select", "limit", "on_conflict"):
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
