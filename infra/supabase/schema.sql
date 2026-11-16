-- =====================================================================
-- Eventera: аналітика для звіту — feedback, clicks і лічильник донатів.
--
-- Основна схема (events, artists, profiles, subscriptions, telegram_*)
-- живе в supabase/migrations/ (Роль 3). Цей файл накатувати ПІСЛЯ неї:
-- clicks.event_id посилається на public.events(id).
--
-- Ідемпотентний: можна виконувати в SQL Editor скільки завгодно разів.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Відгуки (плаваюча кнопка «Відгук»)
-- ---------------------------------------------------------------------

create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,   -- null = анонімний відгук
  rating      smallint not null check (rating between 1 and 5),
  liked       text check (char_length(liked) <= 2000),
  disliked    text check (char_length(disliked) <= 2000),
  would_pay   text check (would_pay in ('yes', 'maybe', 'no')),
  page        text check (char_length(page) <= 300),
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at);

-- ---------------------------------------------------------------------
-- Кліки: донат, підписка, квитки, Telegram
-- ---------------------------------------------------------------------

create table if not exists public.clicks (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  kind        text not null check (kind in ('donate', 'subscribe', 'ticket', 'telegram')),
  event_id    bigint references public.events (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists clicks_kind_created_at_idx on public.clicks (kind, created_at);
create index if not exists clicks_event_id_idx on public.clicks (event_id);

-- ---------------------------------------------------------------------
-- RLS: вставляти можуть усі (і анонімні), читати — лише service_role
-- (звіт будуємо з дашборда Supabase / service_role). user_id можна
-- вказати тільки свій або не вказувати.
-- ---------------------------------------------------------------------

alter table public.feedback enable row level security;
alter table public.clicks   enable row level security;

drop policy if exists "anyone: insert feedback" on public.feedback;
create policy "anyone: insert feedback" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

drop policy if exists "anyone: insert click" on public.clicks;
create policy "anyone: insert click" on public.clicks
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- select-політик навмисно немає: anon/authenticated не бачать жодного рядка
revoke all on public.feedback from anon, authenticated;
revoke all on public.clicks   from anon, authenticated;
grant insert on public.feedback to anon, authenticated;
grant insert on public.clicks   to anon, authenticated;

-- ---------------------------------------------------------------------
-- Лічильник донатів для сторінки /support: скільки разів натиснули
-- «Задонатити». security definer — бо самі clicks читати не можна.
--   select public.donate_clicks_count();
-- ---------------------------------------------------------------------

create or replace function public.donate_clicks_count() returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from public.clicks where kind = 'donate';
$$;

revoke all on function public.donate_clicks_count() from public;
grant execute on function public.donate_clicks_count() to anon, authenticated;
