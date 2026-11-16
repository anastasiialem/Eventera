"""«Я чекаю на…» і налаштування сповіщень — для бота.

Працює лише для тих, хто прив'язав Telegram до акаунта на сайті:
список у боті й на сайті — та сама таблиця subscriptions.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

from .supabase import Supabase

PRICE_OPTIONS = (300, 500, 1000)


async def user_for_chat(db: Supabase, chat_id: int) -> str | None:
    rows = await db.select("telegram_links", {"chat_id": f"eq.{chat_id}", "select": "user_id"})
    return rows[0]["user_id"] if rows else None


def clean_query(text: str) -> str:
    """Прибирає символи, що ламають фільтри PostgREST, і зайві пробіли."""
    text = re.sub(r'[,()"\\*%]', " ", text)
    return " ".join(text.split())[:100]


async def find_artists(db: Supabase, query: str, limit: int = 5) -> list[dict]:
    """Артисти, у чиєму імені є query, або з точно таким іншим написанням (aliases)."""
    q = clean_query(query)
    if len(q) < 2:
        return []
    return await db.select("artists", {
        "select": "id,name",
        "or": f'(name.ilike."*{q}*",aliases.cs.{{"{q}"}})',
        "order": "name",
        "limit": str(limit),
    })


@dataclass
class Added:
    ok: bool               # False — уже було в списку
    label: str


async def _insert_subscription(db: Supabase, row: dict) -> bool:
    try:
        await db.insert("subscriptions", row)
        return True
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:      # унікальний індекс: уже підписані
            return False
        raise


async def add_artist(db: Supabase, user_id: str, artist_id: int) -> Added:
    rows = await db.select("artists", {"id": f"eq.{artist_id}", "select": "name"})
    name = rows[0]["name"] if rows else "артист"
    ok = await _insert_subscription(db, {"user_id": user_id, "kind": "artist", "artist_id": artist_id})
    return Added(ok, name)


async def add_keyword(db: Supabase, user_id: str, keyword: str) -> Added:
    keyword = clean_query(keyword)
    ok = await _insert_subscription(db, {"user_id": user_id, "kind": "keyword", "keyword": keyword})
    return Added(ok, keyword)


async def add_event(db: Supabase, user_id: str, event_id: int) -> Added:
    rows = await db.select("events", {"id": f"eq.{event_id}", "select": "title"})
    title = rows[0]["title"] if rows else "подія"
    ok = await _insert_subscription(db, {"user_id": user_id, "kind": "event", "event_id": event_id})
    return Added(ok, title)


async def list_subscriptions(db: Supabase, user_id: str) -> list[dict]:
    """[{id, label}] — що людина чекає, від найновішого."""
    rows = await db.select("subscriptions", {
        "user_id": f"eq.{user_id}",
        "select": "id,kind,keyword,artists(name),events(title,starts_at)",
        "order": "created_at.desc",
    })
    result = []
    for r in rows:
        if r["kind"] == "artist" and r.get("artists"):
            label = f"🎤 {r['artists']['name']}"
        elif r["kind"] == "event" and r.get("events"):
            label = f"🎟 {r['events']['title']}"
        else:
            label = f"🔎 {r.get('keyword') or '—'}"
        result.append({"id": r["id"], "label": label})
    return result


async def remove_subscription(db: Supabase, user_id: str, sub_id: int) -> None:
    await db.delete("subscriptions", {"id": f"eq.{sub_id}", "user_id": f"eq.{user_id}"})


async def get_settings(db: Supabase, user_id: str) -> dict:
    rows = await db.select("profiles", {
        "id": f"eq.{user_id}", "select": "remind_day_before,max_price,telegram_alerts"})
    return rows[0] if rows else {"remind_day_before": False, "max_price": None, "telegram_alerts": True}


async def update_settings(db: Supabase, user_id: str, **values) -> None:
    allowed = {k: v for k, v in values.items() if k in ("remind_day_before", "max_price", "telegram_alerts")}
    if allowed:
        await db.update("profiles", {"id": f"eq.{user_id}"}, allowed)
