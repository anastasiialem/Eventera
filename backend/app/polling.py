"""Локальний запуск бота без публічного URL (long polling).

    cd backend && python -m app.polling

Знімає webhook, тому поки працює локально — бот на Render не отримує повідомлень.
Після тестів перезапустіть сервіс на Render (він поставить webhook знову).
"""
from __future__ import annotations

import asyncio
import logging

from aiogram import Dispatcher

from . import config
from .admin import make_admin_router
from .bot import make_bot, make_router, make_sender, set_commands
from .supabase import Supabase


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = config.load()
    db = Supabase(settings.supabase_url, settings.supabase_key)
    bot = make_bot(settings.bot_token)
    dp = Dispatcher()
    dp.include_router(make_admin_router(db, settings.admin_chat_ids, make_sender, settings.frontend_url))  # першим
    dp.include_router(make_router(db, settings.frontend_url))
    await bot.delete_webhook(drop_pending_updates=False)
    await set_commands(bot, settings.admin_chat_ids)
    me = await bot.get_me()
    logging.info("Бот @%s слухає (Ctrl+C — зупинити)", me.username)
    try:
        await dp.start_polling(bot, allowed_updates=["message", "callback_query"])
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
