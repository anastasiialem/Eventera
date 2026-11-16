"""Розсилка в Telegram з черг бази.

notification_queue — «з'явилась нова подія артиста / вистави, яку ти чекаєш»
reminder_queue     — «завтра подія з твого списку»

Після успішної відправки — рядок у notifications_sent, тож повторно не прийде.
Email-канал тут не обробляється (окрема задача).
"""
from __future__ import annotations

import asyncio
import html
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Awaitable, Callable
from zoneinfo import ZoneInfo

from .supabase import Supabase

log = logging.getLogger(__name__)
KYIV = ZoneInfo("Europe/Kyiv")

_MONTHS = ("січня", "лютого", "березня", "квітня", "травня", "червня",
           "липня", "серпня", "вересня", "жовтня", "листопада", "грудня")
_WEEKDAYS = ("пн", "вт", "ср", "чт", "пт", "сб", "нд")


def format_when(starts_at: str) -> str:
    """'2026-11-21T17:00:00+00:00' -> 'сб, 21 листопада, 19:00'"""
    dt = datetime.fromisoformat(starts_at).astimezone(KYIV)
    return f"{_WEEKDAYS[dt.weekday()]}, {dt.day} {_MONTHS[dt.month - 1]}, {dt:%H:%M}"


def render(row: dict, kind: str) -> str:
    title = html.escape(row["title"])
    when = format_when(row["starts_at"])
    venue = f"\n📍 {html.escape(row['venue_name'])}" if row.get("venue_name") else ""
    if kind == "reminder":
        head = "⏰ Нагадування: це вже завтра!"
    else:
        head = "🔔 З'явилась подія, на яку ти чекаєш!"
    return f"{head}\n\n<b>{title}</b>\n🗓 {when}{venue}"


@dataclass
class Message:
    chat_id: int
    text: str
    ticket_url: str | None
    event_url: str
    event_id: int
    kind: str                # new_event | reminder


# send(message) -> True (надіслано) / False (користувач заблокував бота)
Sender = Callable[[Message], Awaitable[bool]]


@dataclass
class Stats:
    sent: int = 0
    blocked: int = 0
    failed: int = 0


async def run(db: Supabase, send: Sender, frontend_url: str) -> dict[str, Stats]:
    result = {}
    for queue, kind in (("notification_queue", "new_event"), ("reminder_queue", "reminder")):
        stats = Stats()
        rows = await db.select(queue, {"channel": "eq.telegram", "select": "*", "limit": "500"})
        for row in rows:
            msg = Message(
                chat_id=int(row["address"]),
                text=render(row, kind),
                ticket_url=row.get("ticket_url"),
                event_url=f"{frontend_url}/event/{row['event_id']}",
                event_id=int(row["event_id"]),
                kind=kind,
            )
            try:
                delivered = await send(msg)
            except Exception:
                log.exception("Не вдалося надіслати %s користувачу %s", row["event_id"], row["user_id"])
                stats.failed += 1
                continue
            if not delivered:
                # людина заблокувала бота — відв'язуємо, щоб не пробувати щогодини
                await db.delete("telegram_links", {"chat_id": f"eq.{msg.chat_id}"})
                stats.blocked += 1
                continue
            await db.insert("notifications_sent", {
                "user_id": row["user_id"], "event_id": row["event_id"],
                "channel": "telegram", "kind": kind,
            }, ignore_duplicates=True)
            stats.sent += 1
            await asyncio.sleep(0.05)   # ліміт Telegram ~30 повідомлень/с
        result[queue] = stats
        log.info("%s: %s", queue, stats)
    return result
