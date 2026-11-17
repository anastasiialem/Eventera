"""Заявки на VIP (vip_requests, таблиця з infra/supabase/schema.sql) — для адмінки бота.

Користувач платить у банку «Eventera VIP» і натискає на сайті «Я оплатив(-ла)» →
рядок у vip_requests зі status='pending'. Адмін звіряє з випискою банки й тисне
✅ / ❌ у боті; ✅ продовжує profiles.vip_until на 30 днів (від поточного кінця VIP,
якщо він ще діє — щоб дострокове продовження не з'їдало дні).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .supabase import Supabase
from .waitlist import is_vip

VIP_DAYS = 30


@dataclass
class Decision:
    user_id: str
    email: str
    vip_until: datetime | None = None      # лише для approve


async def pending(db: Supabase, limit: int = 10) -> list[dict]:
    return await db.select("vip_requests", {
        "status": "eq.pending", "select": "id,user_id,email,created_at",
        "order": "created_at", "limit": str(limit)})


async def count_pending(db: Supabase) -> int:
    return await db.count("vip_requests", {"status": "eq.pending"})


async def _get_pending(db: Supabase, request_id: int) -> dict | None:
    rows = await db.select("vip_requests", {
        "id": f"eq.{request_id}", "status": "eq.pending", "select": "id,user_id,email"})
    return rows[0] if rows else None


def extend(current: str | None, now: datetime, days: int = VIP_DAYS) -> datetime:
    """Новий vip_until: +days від кінця чинного VIP або від зараз."""
    start = now
    if current and is_vip({"vip_until": current}, now):
        start = datetime.fromisoformat(current)
    return start + timedelta(days=days)


async def approve(db: Supabase, request_id: int, now: datetime | None = None) -> Decision | None:
    """None — заявки вже немає серед pending (хтось обробив раніше)."""
    req = await _get_pending(db, request_id)
    if not req:
        return None
    now = now or datetime.now(timezone.utc)
    rows = await db.select("profiles", {"id": f"eq.{req['user_id']}", "select": "vip_until"})
    until = extend(rows[0].get("vip_until") if rows else None, now)
    await db.update("profiles", {"id": f"eq.{req['user_id']}"}, {"vip_until": until.isoformat()})
    # усі заявки цієї людини, що чекають (могла натиснути «Я оплатила» двічі)
    await db.update("vip_requests", {"user_id": f"eq.{req['user_id']}", "status": "eq.pending"},
                    {"status": "approved"})
    return Decision(req["user_id"], req["email"], until)


async def reject(db: Supabase, request_id: int) -> Decision | None:
    req = await _get_pending(db, request_id)
    if not req:
        return None
    await db.update("vip_requests", {"id": f"eq.{request_id}"}, {"status": "rejected"})
    return Decision(req["user_id"], req["email"])


async def chat_for_user(db: Supabase, user_id: str) -> int | None:
    rows = await db.select("telegram_links", {"user_id": f"eq.{user_id}", "select": "chat_id"})
    return rows[0]["chat_id"] if rows else None
