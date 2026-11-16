"""Бот @Eventera_lviv_bot.

Команди: /start [токен], /add <артист або вистава>, /list, /settings, /stop, /help.
Будь-який звичайний текст = пошук, як /add.
"""
from __future__ import annotations

import asyncio
import html
import logging

from aiogram import Bot, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError, TelegramRetryAfter
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.filters.callback_data import CallbackData
from aiogram.types import (BotCommand, BotCommandScopeChat, CallbackQuery, InlineKeyboardButton,
                           InlineKeyboardMarkup, Message)

from . import notify, waitlist
from .supabase import Supabase
from .telegram_links import LinkResult, link_chat, unlink_chat

log = logging.getLogger(__name__)

COMMANDS = [
    BotCommand(command="add", description="Додати артиста або виставу"),
    BotCommand(command="list", description="Мій список «Я чекаю на…»"),
    BotCommand(command="settings", description="Нагадування, ліміт ціни"),
    BotCommand(command="stop", description="Вимкнути сповіщення"),
    BotCommand(command="help", description="Довідка"),
]


# ---------- callback-и кнопок (≤ 64 байти) ----------

class AddArtist(CallbackData, prefix="aa"):
    artist_id: int


class AddKeyword(CallbackData, prefix="ak"):
    pass                     # саме слово беремо з _pending (воно може не влізти в 64 байти)


class Remove(CallbackData, prefix="rm"):
    sub_id: int


class Remind(CallbackData, prefix="rd"):
    event_id: int


class Setting(CallbackData, prefix="st"):
    name: str                # remind | alerts | price
    value: int = 0           # для price: 0 = без ліміту


def make_bot(token: str) -> Bot:
    return Bot(token, default=DefaultBotProperties(parse_mode=ParseMode.HTML,
                                                   link_preview_is_disabled=True))


def make_router(db: Supabase, frontend_url: str) -> Router:
    router = Router()
    waitlist_url = f"{frontend_url}/waitlist"
    not_linked = ("Спершу підключи свій акаунт Eventera: увійди на сайті й натисни «Сповіщення в Telegram» — "
                  f"{waitlist_url}\nПісля цього список можна вести прямо тут.")
    _pending: dict[int, str] = {}   # chat_id -> останній пошуковий запит (для кнопки «підписатись на слово»)

    async def need_user(chat_id: int) -> str | None:
        return await waitlist.user_for_chat(db, chat_id)

    # ---------- прив'язка ----------

    @router.message(CommandStart())
    async def start(message: Message, command: CommandObject) -> None:
        token = (command.args or "").strip()
        if not token:
            linked = await need_user(message.chat.id)
            await message.answer(
                "Привіт! Я бот <b>Eventera</b> 🎶\n\n"
                "Пишу, щойно у Львові з'являється подія артиста чи вистава зі списку «Я чекаю на…», "
                "і нагадую за день до події.\n\n"
                + ("Напиши ім'я артиста або назву вистави, і я додам у твій список. Команди: /list, /settings"
                   if linked else not_linked)
            )
            return
        user = message.from_user
        result = await link_chat(db, token, message.chat.id, user.username if user else None)
        if result is LinkResult.LINKED:
            await message.answer(
                "Готово ✅ Telegram підключено до твого акаунта Eventera.\n\n"
                "Тепер можна просто написати мені ім'я артиста або назву вистави, наприклад <i>Скрябін</i> "
                "чи <i>Лускунчик</i>, і я додам у «Я чекаю на…».\n"
                "/list — твій список · /settings — нагадування й ціна · /stop — вимкнути"
            )
        elif result is LinkResult.EXPIRED:
            await message.answer("Посилання застаріло (діє 15 хвилин). Натисни «Сповіщення в Telegram» на сайті ще раз.")
        else:
            await message.answer("Посилання недійсне або вже використане. Натисни «Сповіщення в Telegram» на сайті ще раз.")

    @router.message(Command("stop"))
    async def stop(message: Message) -> None:
        await unlink_chat(db, message.chat.id)
        await message.answer(f"Сповіщення вимкнено 🔕 Підключити знову можна на сайті: {waitlist_url}")

    @router.message(Command("help"))
    async def help_(message: Message) -> None:
        await message.answer(
            "Просто напиши ім'я артиста або назву вистави — я знайду й додам у твій список.\n\n"
            "/add &lt;назва&gt; — те саме\n/list — мій список (з кнопками видалення)\n"
            "/settings — нагадування за день, ліміт ціни, вимкнути сповіщення\n/stop — відключити Telegram\n\n"
            f"Сайт: {waitlist_url}"
        )

    # ---------- додати ----------

    async def search_and_offer(message: Message, query: str) -> None:
        user_id = await need_user(message.chat.id)
        if not user_id:
            await message.answer(not_linked)
            return
        query = waitlist.clean_query(query)
        if len(query) < 2:
            await message.answer("Напиши ім'я артиста або назву вистави, наприклад: <code>/add Скрябін</code>")
            return
        _pending[message.chat.id] = query
        artists = await waitlist.find_artists(db, query)
        if not artists:
            added = await waitlist.add_keyword(db, user_id, query)
            await message.answer(
                f"Додала «{html.escape(added.label)}» у список 🔎 Напишу, щойно з'явиться подія з цим словом у назві чи серед артистів."
                if added.ok else f"«{html.escape(added.label)}» уже є у твоєму списку.")
            return
        rows = [[InlineKeyboardButton(text=f"🎤 {a['name']}", callback_data=AddArtist(artist_id=a["id"]).pack())]
                for a in artists]
        rows.append([InlineKeyboardButton(text=f"🔎 Шукати за словом «{query[:30]}»",
                                          callback_data=AddKeyword().pack())])
        await message.answer("Кого додати у «Я чекаю на…»?", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))

    @router.message(Command("add"))
    async def add_cmd(message: Message, command: CommandObject) -> None:
        await search_and_offer(message, command.args or "")

    @router.callback_query(AddArtist.filter())
    async def add_artist_cb(call: CallbackQuery, callback_data: AddArtist) -> None:
        user_id = await need_user(call.message.chat.id)
        if not user_id:
            await call.answer("Спершу підключи акаунт на сайті", show_alert=True)
            return
        added = await waitlist.add_artist(db, user_id, callback_data.artist_id)
        text = (f"Додала 🎤 <b>{html.escape(added.label)}</b> ✅ Напишу, щойно з'явиться концерт у Львові."
                if added.ok else f"🎤 {html.escape(added.label)} уже є у твоєму списку.")
        await call.message.edit_text(text)
        await call.answer()

    @router.callback_query(AddKeyword.filter())
    async def add_keyword_cb(call: CallbackQuery) -> None:
        user_id = await need_user(call.message.chat.id)
        query = _pending.get(call.message.chat.id)
        if not user_id or not query:
            await call.answer("Напиши запит ще раз", show_alert=True)
            return
        added = await waitlist.add_keyword(db, user_id, query)
        await call.message.edit_text(
            f"Додала 🔎 «{html.escape(added.label)}» ✅" if added.ok else f"«{html.escape(added.label)}» уже є у списку.")
        await call.answer()

    @router.callback_query(Remind.filter())
    async def remind_cb(call: CallbackQuery, callback_data: Remind) -> None:
        user_id = await need_user(call.message.chat.id)
        if not user_id:
            await call.answer("Спершу підключи акаунт на сайті", show_alert=True)
            return
        await waitlist.add_event(db, user_id, callback_data.event_id)
        settings = await waitlist.get_settings(db, user_id)
        if not settings.get("remind_day_before"):
            await waitlist.update_settings(db, user_id, remind_day_before=True)
        await call.answer("Нагадаю за день до події ⏰", show_alert=False)

    # ---------- список ----------

    async def render_list(user_id: str) -> tuple[str, InlineKeyboardMarkup | None]:
        subs = await waitlist.list_subscriptions(db, user_id)
        if not subs:
            return ("Твій список «Я чекаю на…» порожній. Напиши ім'я артиста або назву вистави, щоб додати.", None)
        rows = [[InlineKeyboardButton(text=f"❌ {s['label'][:50]}", callback_data=Remove(sub_id=s["id"]).pack())]
                for s in subs[:30]]
        return (f"<b>Я чекаю на…</b> ({len(subs)})\nНатисни, щоб прибрати зі списку:",
                InlineKeyboardMarkup(inline_keyboard=rows))

    @router.message(Command("list"))
    async def list_cmd(message: Message) -> None:
        user_id = await need_user(message.chat.id)
        if not user_id:
            await message.answer(not_linked)
            return
        text, markup = await render_list(user_id)
        await message.answer(text, reply_markup=markup)

    @router.callback_query(Remove.filter())
    async def remove_cb(call: CallbackQuery, callback_data: Remove) -> None:
        user_id = await need_user(call.message.chat.id)
        if not user_id:
            await call.answer()
            return
        await waitlist.remove_subscription(db, user_id, callback_data.sub_id)
        text, markup = await render_list(user_id)
        try:
            await call.message.edit_text(text, reply_markup=markup)
        except TelegramBadRequest:
            pass                     # «message is not modified» — подвійне натискання
        await call.answer("Прибрала зі списку")

    # ---------- налаштування ----------

    def settings_view(s: dict) -> tuple[str, InlineKeyboardMarkup]:
        price = s.get("max_price")
        yes = lambda v: "✅" if v else "▫️"   # noqa: E731
        rows = [
            [InlineKeyboardButton(text=f"{yes(s.get('remind_day_before'))} Нагадувати за день до події",
                                  callback_data=Setting(name="remind").pack())],
            [InlineKeyboardButton(text=f"{yes(s.get('telegram_alerts'))} Сповіщення в Telegram",
                                  callback_data=Setting(name="alerts").pack())],
        ]
        # ціни — по дві кнопки в рядку, інакше Telegram обрізає підписи на телефоні
        price_buttons = [
            InlineKeyboardButton(text=f"{'✅ ' if price == p else ''}{p} ₴",
                                 callback_data=Setting(name="price", value=p).pack())
            for p in waitlist.PRICE_OPTIONS
        ] + [InlineKeyboardButton(text=f"{'✅ ' if price is None else ''}Без ліміту",
                                  callback_data=Setting(name="price", value=0).pack())]
        rows += [price_buttons[i:i + 2] for i in range(0, len(price_buttons), 2)]
        limit = f"до {price} ₴" if price else "без ліміту"
        return (f"<b>Налаштування</b>\nЛіміт ціни для сповіщень: {limit}", InlineKeyboardMarkup(inline_keyboard=rows))

    @router.message(Command("settings"))
    async def settings_cmd(message: Message) -> None:
        user_id = await need_user(message.chat.id)
        if not user_id:
            await message.answer(not_linked)
            return
        text, markup = settings_view(await waitlist.get_settings(db, user_id))
        await message.answer(text, reply_markup=markup)

    @router.callback_query(Setting.filter())
    async def setting_cb(call: CallbackQuery, callback_data: Setting) -> None:
        user_id = await need_user(call.message.chat.id)
        if not user_id:
            await call.answer()
            return
        s = await waitlist.get_settings(db, user_id)
        if callback_data.name == "remind":
            await waitlist.update_settings(db, user_id, remind_day_before=not s.get("remind_day_before"))
        elif callback_data.name == "alerts":
            await waitlist.update_settings(db, user_id, telegram_alerts=not s.get("telegram_alerts"))
        elif callback_data.name == "price":
            await waitlist.update_settings(db, user_id, max_price=callback_data.value or None)
        text, markup = settings_view(await waitlist.get_settings(db, user_id))
        try:
            await call.message.edit_text(text, reply_markup=markup)
        except TelegramBadRequest:
            pass
        await call.answer("Збережено")

    # ---------- звичайний текст = пошук ----------

    @router.message(F.text & ~F.text.startswith("/"))
    async def text_search(message: Message) -> None:
        await search_and_offer(message, message.text)

    return router


async def set_commands(bot: Bot, admin_ids: frozenset[int] = frozenset()) -> None:
    await bot.set_my_commands(COMMANDS)
    for chat_id in admin_ids:   # /admin видно в меню лише адмінам
        try:
            await bot.set_my_commands([BotCommand(command="admin", description="🛠 Адмінка")] + COMMANDS,
                                      scope=BotCommandScopeChat(chat_id=chat_id))
        except Exception:
            log.warning("Не вдалось поставити меню адміна для %s (бот ще не писав у цей чат?)", chat_id)


def make_sender(bot: Bot) -> notify.Sender:
    async def send(msg: notify.Message) -> bool:
        # Telegram відхиляє кнопки з http://localhost — лише публічні https-адреси
        buttons = []
        if msg.ticket_url and msg.ticket_url.startswith("https://"):
            buttons.append(InlineKeyboardButton(text="🎟 Квитки", url=msg.ticket_url))
        if msg.event_url.startswith("https://"):
            buttons.append(InlineKeyboardButton(text="Детальніше", url=msg.event_url))
        rows = [buttons] if buttons else []
        if msg.kind == "new_event":
            rows.append([InlineKeyboardButton(text="⏰ Нагадати за день",
                                              callback_data=Remind(event_id=msg.event_id).pack())])
        markup = InlineKeyboardMarkup(inline_keyboard=rows) if rows else None
        for _ in range(2):
            try:
                await bot.send_message(msg.chat_id, msg.text, reply_markup=markup)
                return True
            except TelegramForbiddenError:
                return False
            except TelegramRetryAfter as e:
                await asyncio.sleep(e.retry_after)
        await bot.send_message(msg.chat_id, msg.text, reply_markup=markup)
        return True

    return send
