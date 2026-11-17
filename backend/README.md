# backend/

- `parser/` — парсер афіш Concert.ua і Karabas, запис у Supabase (Роль 1), див. `parser/README.md`.
  Запускається щогодини через GitHub Actions (`.github/workflows/parser.yml`).
- `app/` — API для сайту + Telegram-бот **@Eventera_lviv_bot** (Роль 3), деплой на Render.

Схема бази даних — `supabase/migrations/` у корені репо.

## app/: API + Telegram-бот

| Endpoint | Хто викликає | Що робить |
|---|---|---|
| `GET /health` | будь-хто | `{"ok": true, "bot": "Eventera_lviv_bot"}` |
| `POST /api/telegram/link` | сайт, `Authorization: Bearer <supabase access_token>` | `{"url": "https://t.me/Eventera_lviv_bot?start=<токен>"}` — токен одноразовий, 15 хв |
| `POST /telegram/webhook` | Telegram (з `X-Telegram-Bot-Api-Secret-Token`) | команди бота |
| `POST /internal/notify` | GitHub Actions щогодини (`Bearer INTERNAL_API_KEY`) | розсилка з `notification_queue` і `reminder_queue` + нагадування адмінам про заявки VIP |

Команди бота (працюють після прив'язки акаунта, список спільний із сайтом):

| Команда | Що робить |
|---|---|
| `/start <токен>` | прив'язати Telegram до акаунта на сайті |
| будь-який текст або `/add <назва>` | шукає артиста (ім'я або aliases) і пропонує кнопки; якщо артиста немає — підписка на слово (`keyword`) |
| `/list` | список «Я чекаю на…» з кнопками ❌ для видалення |
| `/settings` | «Сповіщення в Telegram»; для VIP — «Нагадувати за день» і ліміт ціни 300 / 500 / 1000 / без ліміту |
| `/stop` | відв'язати Telegram |
| `/help` | довідка |

Під кожним сповіщенням про нову подію є кнопка «⏰ Нагадати за день»: додає подію в список і вмикає нагадування.
Якщо людина заблокувала бота, прив'язка видаляється автоматично.
Безкоштовно — до 3 артистів/слів; нагадування й ліміт ціни — лише VIP (`profiles.vip_until > now()`).

Адмінка `/admin` (лише `ADMIN_CHAT_IDS`): 📊 статистика · 💜 заявки VIP · 📣 написати всім · 🔔 розсилка зараз.
**Заявки VIP:** звір email із коментарями в банці «Eventera VIP» і натисни ✅ (VIP на 30 днів від кінця
чинного або від сьогодні) чи ❌. Людина отримає повідомлення в Telegram, якщо його підключено.
Поки є заявки, що чекають, бот щогодини нагадує адмінам.

Як сайт підключає Telegram:
```ts
const { data } = await supabase.auth.getSession()
const r = await fetch(`${import.meta.env.VITE_API_URL}/api/telegram/link`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${data.session?.access_token}` },
})
window.open((await r.json()).url, '_blank')
```

### Локально

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r app/requirements.txt   # один раз
cp .env.example .env                                                     # один раз, заповнити

.venv/bin/python -m app.polling                  # бот у Telegram відповідає з вашого компа
.venv/bin/uvicorn app.main:app --reload          # API на http://localhost:8000
.venv/bin/python -m pytest app/tests             # тести без інтернету
```

`app.polling` знімає webhook. Після локальних тестів перезапустіть сервіс на Render, і він поставить webhook знову.

### Деплой на Render

Конфіг уже в репозиторії: `infra/render.yaml` (Blueprint).

1. Render → **New → Blueprint** → репозиторій `Eventera` → Blueprint Path: `infra/render.yaml`.
2. Render попросить значення змінних — скопіюйте з `backend/.env`:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `INTERNAL_API_KEY`,
   `ADMIN_CHAT_IDS`, `FRONTEND_URL` (адреса сайту на Vercel, `https://…vercel.app`).
   `PUBLIC_BASE_URL` не потрібен: адресу сервісу Render передає сам (`RENDER_EXTERNAL_URL`).
3. Після деплою сервіс сам ставить webhook. Перевірка: `https://<сервіс>.onrender.com/health` і `/start` у боті.
4. GitHub → Settings → Secrets → Actions: `BACKEND_URL` (адреса Render) і `INTERNAL_API_KEY` (те саме значення).
   Розсилка: `.github/workflows/notify.yml`, щогодини.
5. Фронтенду (Vercel): `VITE_TELEGRAM_BOT_URL=https://t.me/Eventera_lviv_bot` і адреса Render для кнопки Telegram.

Безкоштовний Render засинає після ~15 хв без запитів; перше повідомлення боту після сну обробляється до ~1 хв
(Telegram сам повторює запит, повідомлення не губляться).

Email-сповіщення поки не надсилаються: у черзі вони є (`channel = 'email'`), але відправку ще треба додати.
