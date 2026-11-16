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
from fastapi.responses import HTMLResponse

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


_ROOT_PAGE = """<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eventera API</title>
<style>
  :root {{ color-scheme: light; }}
  body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F5E9EC;
         font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #4A2A3F; }}
  main {{ background: #FFFBFA; border-radius: 24px; padding: 32px 28px; max-width: 420px; margin: 16px;
         box-shadow: 0 10px 30px rgba(74,42,63,.08); }}
  h1 {{ font-family: Georgia, serif; font-weight: 400; font-size: 32px; margin: 0 0 4px; }}
  p {{ margin: 0 0 20px; opacity: .8; }}
  a {{ display: block; padding: 12px 16px; margin-top: 10px; border-radius: 999px; text-decoration: none;
      text-align: center; font-weight: 600; color: #4A2A3F; background: #F5E9EC; }}
  a.primary {{ background: #4A2A3F; color: #fff; }}
  small {{ display: block; margin-top: 18px; opacity: .6; text-align: center; }}
</style></head>
<body><main>
  <h1>eventera</h1>
  <p>API і Telegram-бот афіші Львова. Сайт живе окремо; тут — сервер для бота й сайту.</p>
  <a class="primary" href="https://t.me/{bot}">Відкрити бота @{bot}</a>
  {site}
  <a href="/docs">Документація API</a>
  <small>Стан: <a href="/health" style="display:inline;padding:0;background:none;margin:0">/health</a></small>
</main></body></html>"""


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root() -> str:
    site = (f'<a href="{settings.frontend_url}">Сайт Eventera</a>'
            if settings.frontend_url.startswith("https://") else "")
    return _ROOT_PAGE.format(bot=_bot_username or "Eventera_lviv_bot", site=site)


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
