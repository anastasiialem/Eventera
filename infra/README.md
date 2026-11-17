# infra/

Інфраструктура й деплой Eventera.

| Шлях | Що це |
|---|---|
| `supabase/schema.sql` | Таблиці аналітики `feedback`, `clicks`, заявки на VIP `vip_requests` + RLS + RPC `donate_clicks_count()` |
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
