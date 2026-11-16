# infra/

Інфраструктура й деплой Eventera.

| Шлях | Що це |
|---|---|
| `supabase/schema.sql` | Таблиці аналітики `feedback`, `clicks` + RLS + RPC `donate_clicks_count()` |
| `../supabase/migrations/` | Основна схема БД (Роль 3): події, артисти, профілі, підписки, Telegram |
| `../frontend/vercel.json` | SPA-rewrite для Vercel |
| `../.github/workflows/frontend.yml` | CI: lint + build фронтенду |

## Як застосувати схему

1. Спершу міграції Ролі 3 (`supabase db push` або по черзі файли з `supabase/migrations/` у SQL Editor).
2. Потім `infra/supabase/schema.sql` у SQL Editor. Файл ідемпотентний — повторний запуск безпечний.

## Деплой

- **Frontend** — Vercel: Root Directory = `frontend`, Build = `npm run build`, Output = `dist`.
  Змінні середовища — з `frontend/.env.example` (тільки `VITE_SUPABASE_ANON_KEY`, ніколи `service_role`).
- **Backend** (API + Telegram-бот) — Render, див. `backend/README.md`.
