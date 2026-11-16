"""Налаштування з оточення. Локально — з backend/.env, на Render — з Environment."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Не задано {name} (див. backend/.env.example)")
    return value


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_key: str              # service_role / sb_secret — тільки на сервері
    bot_token: str
    webhook_secret: str            # Telegram додає його в заголовок кожного webhook-запиту
    internal_api_key: str          # захищає /internal/notify (його викликає GitHub Actions)
    public_base_url: str | None    # https://<сервіс>.onrender.com; порожньо = webhook не ставимо
    frontend_url: str              # для посилань у повідомленнях і CORS
    admin_chat_ids: frozenset[int]  # Telegram chat_id адмінів (/admin); порожньо = адмінки немає


def load() -> Settings:
    return Settings(
        supabase_url=_required("SUPABASE_URL").rstrip("/"),
        supabase_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        bot_token=_required("TELEGRAM_BOT_TOKEN"),
        webhook_secret=_required("TELEGRAM_WEBHOOK_SECRET"),
        internal_api_key=_required("INTERNAL_API_KEY"),
        public_base_url=(os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/") or None,
        frontend_url=(os.environ.get("FRONTEND_URL") or "http://localhost:5173").rstrip("/"),
        admin_chat_ids=frozenset(
            int(x) for x in (os.environ.get("ADMIN_CHAT_IDS") or "").replace(" ", "").split(",") if x
        ),
    )
