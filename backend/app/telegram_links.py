"""Прив'язка Telegram до акаунта на сайті.

1. Сайт: POST /api/telegram/link → створюємо одноразовий токен (15 хв)
   і віддаємо https://t.me/<бот>?start=<токен>
2. Людина натискає Start → бот отримує "/start <токен>" → link_chat()
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from .supabase import Supabase


class LinkResult(Enum):
    LINKED = "linked"
    INVALID = "invalid"     # такого токена немає (або вже використаний)
    EXPIRED = "expired"


async def create_link_token(db: Supabase, user_id: str) -> str:
    rows = await db.insert("telegram_link_tokens", {"user_id": user_id}, returning=True)
    return rows[0]["token"]


async def link_chat(db: Supabase, token: str, chat_id: int, username: str | None) -> LinkResult:
    rows = await db.select("telegram_link_tokens",
                           {"token": f"eq.{token}", "select": "user_id,expires_at"})
    if not rows:
        return LinkResult.INVALID
    await db.delete("telegram_link_tokens", {"token": f"eq.{token}"})   # одноразовий

    expires_at = datetime.fromisoformat(rows[0]["expires_at"])
    if expires_at < datetime.now(timezone.utc):
        return LinkResult.EXPIRED

    # цей чат міг бути прив'язаний до іншого акаунта — переносимо
    await db.delete("telegram_links", {"chat_id": f"eq.{chat_id}"})
    await db.insert("telegram_links",
                    {"user_id": rows[0]["user_id"], "chat_id": chat_id, "username": username},
                    upsert_on="user_id")
    return LinkResult.LINKED


async def unlink_chat(db: Supabase, chat_id: int) -> None:
    await db.delete("telegram_links", {"chat_id": f"eq.{chat_id}"})
