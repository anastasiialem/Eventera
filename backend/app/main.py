"""FastAPI-сервіс: webhook бота, прив'язка Telegram для сайту, розсилка.

Локально:   uvicorn app.main:app --reload        (з папки backend/)
На Render:  див. infra/backend.Dockerfile
"""
from __future__ import annotations

import hmac
import logging
from contextlib import asynccontextmanager

from aiogram import Dispatcher
from aiogram.types import Update
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from . import config, notify
from .admin import make_admin_router
from .bot import make_bot, make_router, make_sender, set_commands
from .supabase import Supabase
from .telegram_links import create_link_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("eventera")

settings = config.load()
db = Supabase(settings.supabase_url, settings.supabase_key)
bot = make_bot(settings.bot_token)
dp = Dispatcher()
dp.include_router(make_admin_router(db, settings.admin_chat_ids, make_sender, settings.frontend_url))  # першим
dp.include_router(make_router(db, settings.frontend_url))
_bot_username: str | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _bot_username
    me = await bot.get_me()
    _bot_username = me.username
    await set_commands(bot, settings.admin_chat_ids)
    if settings.public_base_url:
        await bot.set_webhook(
            f"{settings.public_base_url}/telegram/webhook",
            secret_token=settings.webhook_secret,
            allowed_updates=["message", "callback_query"],
        )
        log.info("Webhook @%s -> %s/telegram/webhook", me.username, settings.public_base_url)
    else:
        log.info("PUBLIC_BASE_URL не задано: webhook не ставлю (локально бот — через python -m app.polling)")
    yield
    await bot.session.close()
    await db.close()


app = FastAPI(title="Eventera API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted({settings.frontend_url, "http://localhost:5173"}),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


def _check_secret(given: str | None, expected: str) -> None:
    if not given or not hmac.compare_digest(given, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "bot": _bot_username}


@app.post("/telegram/webhook")
async def telegram_webhook(request: Request,
                           x_telegram_bot_api_secret_token: str | None = Header(default=None)) -> dict:
    _check_secret(x_telegram_bot_api_secret_token, settings.webhook_secret)
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}


@app.post("/api/telegram/link")
async def telegram_link(authorization: str | None = Header(default=None)) -> dict:
    """Сайт (залогінений користувач) отримує посилання на бота з одноразовим токеном."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Потрібен вхід")
    user_id = await db.user_id_from_token(authorization.split(" ", 1)[1])
    if not user_id:
        raise HTTPException(status_code=401, detail="Сесія недійсна")
    token = await create_link_token(db, user_id)
    return {"url": f"https://t.me/{_bot_username}?start={token}"}


@app.post("/internal/notify")
async def internal_notify(authorization: str | None = Header(default=None)) -> dict:
    """Розсилка з черг. Викликає GitHub Actions щогодини (.github/workflows/notify.yml)."""
    _check_secret((authorization or "").removeprefix("Bearer ").strip() or None, settings.internal_api_key)
    stats = await notify.run(db, make_sender(bot), settings.frontend_url)
    return {queue: vars(s) for queue, s in stats.items()}
