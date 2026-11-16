# Eventera

Усі концерти й вистави Львова в одному місці. Eventera збирає афіші з Concert.ua, Karabas, сайтів театрів
і Telegram-каналів, а у списку «Я чекаю на…» можна підписатися на артиста й отримати сповіщення,
щойно в нього з'явиться подія у Львові.

## Структура

| Папка | Що там |
|---|---|
| `frontend/` | Сайт: Vite + React + TypeScript + Tailwind, деплой на Vercel |
| `backend/` | Парсер афіш, API і Telegram-бот (деплой на Render) |
| `supabase/` | Основна схема бази даних (міграції) |
| `infra/` | SQL для аналітики, нотатки про деплой |
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

## База даних

1. Міграції з `supabase/migrations/` (див. `supabase/README.md`).
2. Потім `infra/supabase/schema.sql` у SQL Editor Supabase.

## Деплой

Детальніше — у `infra/README.md`. Коротко: Vercel, Root Directory = `frontend`, змінні з `frontend/.env.example`.
