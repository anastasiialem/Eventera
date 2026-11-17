# infra/

Інфраструктура й деплой Eventera.

| Шлях | Що це |
|---|---|
| `supabase/schema.sql` | Таблиці аналітики `feedback`, `clicks`, заявки на VIP `vip_requests` + RLS + RPC `donate_clicks_count()` |
| `../supabase/migrations/` | Основна схема БД (Роль 3): події, артисти, профілі, підписки, Telegram |
| `frontend.Dockerfile` + `nginx.conf` | Образ фронтенду: Vite build → nginx (SPA fallback, gzip, кеш `/assets`, `/healthz`) |
| `backend.Dockerfile` | Образ API + Telegram-бота (його використовує Render, `render.yaml`) |
| `parser.Dockerfile` | Образ парсера (одноразовий запуск) |
| `docker-compose.yml` | Локальний запуск усього разом |
| `render.yaml` | Render Blueprint для backend |
| `../frontend/vercel.json` | SPA-rewrite для Vercel |
| `../.github/workflows/ci.yml` | CI: lint + test + build фронтенду, збірка Docker-образів |
| `../.github/workflows/parser.yml` | Парсер щогодини о :50 (Роль 1) |
| `../.github/workflows/notify.yml` | Розсилка сповіщень щогодини о :15 (Роль 3) |

## Docker локально

Потрібен Docker Desktop (або Docker Engine з Compose v2). Усі команди — з кореня репо.

```bash
cp .env.example .env          # заповни значення (див. коментарі у файлі)

# frontend → http://localhost:8080, backend → http://localhost:8000/health
docker compose --env-file .env -f infra/docker-compose.yml up --build

# одноразовий запуск парсера (пише події в Supabase)
docker compose --env-file .env -f infra/docker-compose.yml --profile jobs run --rm parser
```

`--env-file .env` обов'язковий: значення `VITE_*` вшиваються у фронтенд під час збірки (build args),
а Compose бере їх для підстановки саме звідси. Backend і parser отримують змінні через `env_file: ../.env`.
Без `VITE_SUPABASE_*` фронтенд усе одно збереться й покаже моки. Backend без `TELEGRAM_BOT_TOKEN` та інших
обов'язкових змінних не стартує (див. `backend/.env.example`).

Тільки фронтенд:

```bash
docker build -f infra/frontend.Dockerfile -t eventera-frontend \
  --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run --rm -p 8080:8080 eventera-frontend
```

> TODO після демо: `backend.Dockerfile` працює від root. Перед демо його не змінюємо, щоб не ризикувати деплоєм
> на Render. Додати непривілейованого користувача, як у `parser.Dockerfile`.

## GitHub Actions — секрети

Settings → Secrets and variables → Actions → New repository secret:

| Секрет | Хто використовує |
|---|---|
| `SUPABASE_URL` | `parser.yml` |
| `SUPABASE_SERVICE_ROLE_KEY` | `parser.yml` |
| `BACKEND_URL` | `notify.yml` (адреса Render, напр. `https://eventera-api-hbgc.onrender.com`) |
| `INTERNAL_API_KEY` | `notify.yml` (те саме значення, що в Render) |

`ci.yml` секретів не потребує.

## Як застосувати схему

1. Спершу міграції Ролі 3 (`supabase db push` або по черзі файли з `supabase/migrations/` у SQL Editor).
2. Потім `infra/supabase/schema.sql` у SQL Editor. Файл ідемпотентний — повторний запуск безпечний.

## Деплой

- **Frontend** — Vercel: Root Directory = `frontend`, Build = `npm run build`, Output = `dist`.
  Змінні середовища — з `frontend/.env.example` (тільки `VITE_SUPABASE_ANON_KEY`, ніколи `service_role`).
- **Backend** (API + Telegram-бот) — Render, див. `backend/README.md`.

## Як підтвердити VIP

VIP-підписка — 39 ₴/міс в окрему банку monobank «Eventera VIP» (`VITE_VIP_PAY_URL`). Автоматичної перевірки
оплати немає: користувач вказує свій email у коментарі до платежу й натискає «Я оплатив(-ла)», на сайті
з'являється рядок у `vip_requests` зі статусом `pending`.

1. Відкрий виписку банки «Eventera VIP» і знайди платіж з email у коментарі.
2. Подивись заявки, що чекають:

   ```sql
   select id, email, created_at from vip_requests where status = 'pending' order by created_at;
   ```

3. Підтвердь (SQL Editor, підстав email):

   ```sql
   update profiles set vip_until = now() + interval '30 days'
   where id = (select user_id from vip_requests where email = '<email>' order by created_at desc limit 1);

   update vip_requests set status = 'approved' where email = '<email>';
   ```

   Платежу не знайшли — `update vip_requests set status = 'rejected' where id = <id>;`
   (у модалці з'явиться підказка спробувати ще раз).

Колонку `profiles.vip_until timestamptz` додає Роль 3. Поки її немає, сайт вважає всіх користувачів
безкоштовними й нічого не ламається. Після `update` бейдж VIP з'являється, щойно профіль перечитається
(перезавантаж сторінку).
