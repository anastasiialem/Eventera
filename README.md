# Eventera

Усі концерти й вистави Львова в одному місці. Eventera щогодини збирає афіші з Concert.ua і Karabas
(збирати афіші ще й із сайтів театрів і Telegram-каналів — у планах), а у списку «Я чекаю на…» можна підписатися на артиста
й отримати сповіщення в Telegram, щойно в нього з'явиться подія у Львові.

**Сайт:** <!-- TODO: вставити адресу з Vercel --> https://…vercel.app · **Бот:** [@Eventera_lviv_bot](https://t.me/Eventera_lviv_bot)

## Структура

| Папка | Що там |
|---|---|
| `frontend/` | Сайт: Vite + React + TypeScript + Tailwind, деплой на Vercel |
| `backend/` | Парсер афіш, API і Telegram-бот (деплой на Render) |
| `supabase/` | Основна схема бази даних (міграції) |
| `infra/` | Dockerfile-и, docker-compose, nginx, SQL для аналітики, нотатки про деплой |
| `design/` | Макети й опис продукту |

## Запуск фронтенду локально

```bash
cd frontend
npm install
cp .env.example .env.local   # заповни ключі Supabase (необов'язково)
npm run dev                  # http://localhost:5173
```

Без `.env.local` сайт працює на демо-даних (`frontend/src/mocks/events.ts`).
Порядок джерел даних: API (`VITE_API_URL`) → Supabase напряму → моки.

## Усе разом у Docker

```bash
cp .env.example .env    # заповни значення
docker compose --env-file .env -f infra/docker-compose.yml up --build   # сайт: http://localhost:8080
```

Подробиці (окремий запуск парсера, секрети GitHub Actions) — у `infra/README.md`.

## Парсер афіш

Код — `backend/parser/` (Python), докладно — `backend/parser/README.md`. Збирає події Львова з Concert.ua
і Karabas, склеює одну подію з двох сайтів і записує в Supabase. На сервері запускається щогодини
через GitHub Actions (`.github/workflows/parser.yml`, секрети `SUPABASE_URL` і `SUPABASE_SERVICE_ROLE_KEY`).

Локально:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r parser/requirements.txt
python -m parser.run              # лише показати, що знайшлося
cp .env.example .env              # вписати SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY
python -m parser.run --db         # записати в базу
python -m pytest parser/tests     # тести
```

## Telegram-бот

Сповіщення надсилає бот [@Eventera_lviv_bot](https://t.me/Eventera_lviv_bot) (код — `backend/app/`, деплой на Render).
Кнопка «Сповіщення в Telegram» на сайті просить у бекенду (`VITE_BACKEND_URL`) одноразове посилання
`https://t.me/Eventera_lviv_bot?start=<токен>`, яке прив'язує Telegram до акаунта. Безкоштовний Render засинає,
тому перше натискання може тривати до хвилини; якщо бекенд не відповів — відкривається просто бот.

## База даних

1. Міграції з `supabase/migrations/` (див. `supabase/README.md`).
2. Потім `infra/supabase/schema.sql` у SQL Editor Supabase.

## Деплой

Детальніше — у `infra/README.md`. Коротко: Vercel, Root Directory = `frontend`, змінні з `frontend/.env.example`
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`, `VITE_TELEGRAM_BOT_URL`, `VITE_DONATE_URL`, `VITE_ENABLE_GOOGLE`).
