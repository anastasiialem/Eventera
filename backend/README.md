# backend/

- `parser/` — парсер афіш + AI-витягування полів (Роль 1), див. `parser/README.md`.
- `app/` — API для сайту + Telegram-бот **@Eventera_lviv_bot** (Роль 3), деплой на Render.

Схема бази даних — `supabase/migrations/` у корені репо.

## app/: API + Telegram-бот

| Endpoint | Хто викликає | Що робить |
|---|---|---|
| `GET /health` | будь-хто | `{"ok": true, "bot": "Eventera_lviv_bot"}` |
| `POST /api/telegram/link` | сайт, `Authorization: Bearer <supabase access_token>` | `{"url": "https://t.me/Eventera_lviv_bot?start=<токен>"}` — токен одноразовий, 15 хв |
| `POST /telegram/webhook` | Telegram (з `X-Telegram-Bot-Api-Secret-Token`) | команди бота |
| `POST /internal/notify` | GitHub Actions щогодини (`Bearer INTERNAL_API_KEY`) | розсилка з `notification_queue` і `reminder_queue` |

Команди бота (працюють після прив'язки акаунта, список спільний із сайтом):

| Команда | Що робить |
|---|---|
| `/start <токен>` | прив'язати Telegram до акаунта на сайті |
| будь-який текст або `/add <назва>` | шукає артиста (ім'я або aliases) і пропонує кнопки; якщо артиста немає — підписка на слово (`keyword`) |
| `/list` | список «Я чекаю на…» з кнопками ❌ для видалення |
| `/settings` | «Нагадувати за день», «Сповіщення в Telegram», ліміт ціни 300 / 500 / 1000 / без ліміту |
| `/stop` | відв'язати Telegram |
| `/help` | довідка |

Під кожним сповіщенням про нову подію є кнопка «⏰ Нагадати за день»: додає подію в список і вмикає нагадування.
Якщо людина заблокувала бота, прив'язка видаляється автоматично.

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

1. New → Web Service → репозиторій, **Runtime: Docker**:
   - Dockerfile Path: `infra/backend.Dockerfile`
   - Docker Build Context Directory: `backend`
   - Health Check Path: `/health`
2. Environment: усі змінні з `.env.example`. `PUBLIC_BASE_URL` = адреса сервісу на Render (`https://….onrender.com`), `FRONTEND_URL` = адреса сайту на Vercel.
3. Після деплою сервіс сам ставить webhook. Перевірка: напишіть боту `/start`.
4. GitHub → Settings → Secrets → Actions: `BACKEND_URL` (адреса Render) і `INTERNAL_API_KEY` (те саме значення, що на Render).
   Розсилка: `.github/workflows/notify.yml`, щогодини.
5. Фронтенду (Vercel): `VITE_API_URL` = адреса Render, `VITE_TELEGRAM_BOT_URL=https://t.me/Eventera_lviv_bot`.

Email-сповіщення поки не надсилаються: у черзі вони є (`channel = 'email'`), але відправку ще треба додати.
