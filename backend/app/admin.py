"""Адмінка бота (/admin) — лише для chat_id з ADMIN_CHAT_IDS.

📊 Статистика · 📣 Написати всім · 🔔 Запустити розсилку зараз
"""
from __future__ import annotations

import asyncio
import html
import logging
from collections import Counter
from datetime import datetime, timezone

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError, TelegramRetryAfter
from aiogram.filters import Command
from aiogram.filters.callback_data import CallbackData
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from . import notify
from .supabase import Supabase

log = logging.getLogger(__name__)


class Admin(CallbackData, prefix="ad"):
    action: str     # menu | stats | bc | bc_send | bc_cancel | notify


def _kb(*rows: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t, callback_data=Admin(action=a).pack()) for t, a in row] for row in rows])


MENU_KB = _kb([("📊 Статистика", "stats")],
              [("📣 Написати всім", "bc")],
              [("🔔 Запустити розсилку зараз", "notify")])
BACK_KB = _kb([("← Меню", "menu")])


async def recipients(db: Supabase) -> list[int]:
    """Усі, хто підключив Telegram і не вимкнув сповіщення."""
    links = await db.select("telegram_links", {"select": "chat_id,profiles(telegram_alerts)"})
    return [r["chat_id"] for r in links if (r.get("profiles") or {}).get("telegram_alerts", True)]


async def stats_text(db: Supabase) -> str:
    now = datetime.now(timezone.utc).isoformat()
    users, linked, subs, events, upcoming, sent = await asyncio.gather(
        db.count("profiles"), db.count("telegram_links"), db.count("subscriptions"),
        db.count("events"), db.count("events", {"starts_at": f"gte.{now}"}),
        db.count("notifications_sent"),
    )
    kinds = Counter(r["kind"] for r in await db.select("subscriptions", {"select": "kind"}))
    artist_subs = await db.select("subscriptions", {"kind": "eq.artist", "select": "artists(name)"})
    top = Counter(r["artists"]["name"] for r in artist_subs if r.get("artists")).most_common(5)
    top_lines = "\n".join(f"  {i}. {html.escape(n)} — {c}" for i, (n, c) in enumerate(top, 1)) or "  поки нікого"
    return (
        "📊 <b>Eventera зараз</b>\n\n"
        f"👤 Користувачів: <b>{users}</b>\n"
        f"✈️ Підключили Telegram: <b>{linked}</b>\n"
        f"⭐ У списках «Я чекаю на…»: <b>{subs}</b> "
        f"(артисти {kinds.get('artist', 0)} · слова {kinds.get('keyword', 0)} · події {kinds.get('event', 0)})\n"
        f"🎫 Подій у базі: <b>{events}</b>, майбутніх: <b>{upcoming}</b>\n"
        f"📨 Надіслано сповіщень: <b>{sent}</b>\n\n"
        f"🔥 <b>Найочікуваніші артисти</b>\n{top_lines}"
    )


def make_admin_router(db: Supabase, admin_ids: frozenset[int], sender_factory, frontend_url: str) -> Router:
    router = Router()
    router.message.filter(F.chat.id.in_(admin_ids))
    router.callback_query.filter(F.message.chat.id.in_(admin_ids))

    awaiting: set[int] = set()                 # адмін зараз пише текст розсилки
    drafts: dict[int, int] = {}                 # chat_id адміна -> message_id чернетки

    async def show_menu(target: Message, edit: bool = False) -> None:
        text = "🛠 <b>Адмінка Eventera</b>\nЩо робимо?"
        if edit:
            try:
                await target.edit_text(text, reply_markup=MENU_KB)
                return
            except TelegramBadRequest:
                pass
        await target.answer(text, reply_markup=MENU_KB)

    @router.message(Command("admin"))
    async def admin_cmd(message: Message) -> None:
        awaiting.discard(message.chat.id)
        await show_menu(message)

    @router.callback_query(Admin.filter(F.action == "menu"))
    async def menu_cb(call: CallbackQuery) -> None:
        awaiting.discard(call.message.chat.id)
        await show_menu(call.message, edit=True)
        await call.answer()

    @router.callback_query(Admin.filter(F.action == "stats"))
    async def stats_cb(call: CallbackQuery) -> None:
        await call.message.edit_text(await stats_text(db), reply_markup=_kb([("🔄 Оновити", "stats"), ("← Меню", "menu")]))
        await call.answer()

    # ---------- 📣 написати всім ----------

    @router.callback_query(Admin.filter(F.action == "bc"))
    async def broadcast_start(call: CallbackQuery) -> None:
        n = len(await recipients(db))
        awaiting.add(call.message.chat.id)
        await call.message.edit_text(
            "📣 <b>Повідомлення всім</b>\n\n"
            f"Отримають: <b>{n}</b> (усі, хто підключив Telegram і не вимкнув сповіщення).\n\n"
            "Надішли мені текст — можна з <b>жирним</b>, <i>курсивом</i>, емодзі, посиланнями або фото з підписом. "
            "Я покажу, як воно виглядатиме, і спитаю підтвердження.",
            reply_markup=_kb([("❌ Скасувати", "bc_cancel")]),
        )
        await call.answer()

    @router.message(lambda m: m.chat.id in awaiting)
    async def broadcast_draft(message: Message) -> None:
        awaiting.discard(message.chat.id)
        drafts[message.chat.id] = message.message_id
        n = len(await recipients(db))
        await message.answer("👆 Так це побачать усі. Надсилаємо?")
        await message.copy_to(message.chat.id)   # попередній перегляд саме так, як прийде людям
        await message.answer(
            f"Отримувачів: <b>{n}</b>",
            reply_markup=_kb([(f"✅ Надіслати {n}", "bc_send")], [("✏️ Написати інакше", "bc"), ("❌ Скасувати", "bc_cancel")]),
        )

    @router.callback_query(Admin.filter(F.action == "bc_cancel"))
    async def broadcast_cancel(call: CallbackQuery) -> None:
        awaiting.discard(call.message.chat.id)
        drafts.pop(call.message.chat.id, None)
        await call.message.edit_text("Скасовано.", reply_markup=BACK_KB)
        await call.answer()

    @router.callback_query(Admin.filter(F.action == "bc_send"))
    async def broadcast_send(call: CallbackQuery, bot: Bot) -> None:
        admin_chat = call.message.chat.id
        draft = drafts.pop(admin_chat, None)
        if draft is None:
            await call.answer("Чернетки немає — почни заново", show_alert=True)
            return
        await call.message.edit_text("⏳ Надсилаю…")
        await call.answer()
        ok = blocked = failed = 0
        for chat_id in await recipients(db):
            for _ in range(2):
                try:
                    await bot.copy_message(chat_id, from_chat_id=admin_chat, message_id=draft)
                    ok += 1
                    break
                except TelegramRetryAfter as e:
                    await asyncio.sleep(e.retry_after)
                except TelegramForbiddenError:
                    blocked += 1
                    await db.delete("telegram_links", {"chat_id": f"eq.{chat_id}"})
                    break
                except Exception:
                    log.exception("broadcast -> %s", chat_id)
                    failed += 1
                    break
            await asyncio.sleep(0.05)
        await call.message.edit_text(
            f"✅ <b>Надіслано: {ok}</b>"
            + (f"\n🚫 Заблокували бота: {blocked} (відв'язала)" if blocked else "")
            + (f"\n⚠️ Помилок: {failed}" if failed else ""),
            reply_markup=BACK_KB,
        )

    # ---------- 🔔 розсилка з черг зараз ----------

    @router.callback_query(Admin.filter(F.action == "notify"))
    async def notify_now(call: CallbackQuery, bot: Bot) -> None:
        await call.message.edit_text("⏳ Перевіряю нові події й нагадування…")
        await call.answer()
        stats = await notify.run(db, sender_factory(bot), frontend_url)
        new, rem = stats["notification_queue"], stats["reminder_queue"]
        await call.message.edit_text(
            "🔔 <b>Розсилка готова</b>\n\n"
            f"Нові події: надіслано <b>{new.sent}</b>"
            + (f", заблокували {new.blocked}" if new.blocked else "") + (f", помилок {new.failed}" if new.failed else "")
            + f"\nНагадування: надіслано <b>{rem.sent}</b>"
            + (f", заблокували {rem.blocked}" if rem.blocked else "") + (f", помилок {rem.failed}" if rem.failed else ""),
            reply_markup=BACK_KB,
        )

    return router
