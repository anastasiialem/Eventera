-- =====================================================================
-- Eventera: користувачі, список «Я чекаю на…», Telegram і сповіщення
--
-- Логін і паролі живуть у вбудованій схемі Supabase `auth.users`.
-- Тут лише наші дані про користувача, прив'язані до auth.users.id.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Профіль: створюється автоматично при реєстрації
-- ---------------------------------------------------------------------

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text,
  email_alerts     boolean not null default true,
  telegram_alerts  boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Telegram
--
-- 1. Сайт створює одноразовий токен і відкриває t.me/<bot>?start=<token>
-- 2. Бот отримує "/start <token>", знаходить user_id і зберігає chat_id
-- ---------------------------------------------------------------------

create table public.telegram_links (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  chat_id    bigint not null unique,
  username   text,
  linked_at  timestamptz not null default now()
);

create table public.telegram_link_tokens (
  token       text primary key default replace(gen_random_uuid()::text, '-', ''),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '15 minutes',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- «Я чекаю на…»
--   artist  — будь-яка нова подія цього артиста
--   event   — конкретна подія (просто в списку, без сповіщень про нові)
--   keyword — вистава чи шоу без артиста: «Конотопська відьма», «Лускунчик»
-- ---------------------------------------------------------------------

create type public.subscription_kind as enum ('artist', 'event', 'keyword');

create table public.subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        public.subscription_kind not null,
  artist_id   bigint references public.artists (id) on delete cascade,
  event_id    bigint references public.events (id) on delete cascade,
  keyword     text check (char_length(trim(keyword)) between 2 and 100),
  created_at  timestamptz not null default now(),

  constraint subscriptions_target check (
    (kind = 'artist'  and artist_id is not null and event_id is null and keyword is null) or
    (kind = 'event'   and event_id  is not null and artist_id is null and keyword is null) or
    (kind = 'keyword' and keyword   is not null and artist_id is null and event_id is null)
  )
);

create unique index subscriptions_artist_uq  on public.subscriptions (user_id, artist_id) where kind = 'artist';
create unique index subscriptions_event_uq   on public.subscriptions (user_id, event_id)  where kind = 'event';
create unique index subscriptions_keyword_uq on public.subscriptions (user_id, lower(keyword)) where kind = 'keyword';
create index subscriptions_artist_id_idx on public.subscriptions (artist_id) where kind = 'artist';

-- ---------------------------------------------------------------------
-- Що вже надіслали (щоб не слати двічі)
-- ---------------------------------------------------------------------

create type public.notification_channel as enum ('email', 'telegram');

create table public.notifications_sent (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  event_id  bigint not null references public.events (id) on delete cascade,
  channel   public.notification_channel not null,
  sent_at   timestamptz not null default now(),
  primary key (user_id, event_id, channel)
);

-- ---------------------------------------------------------------------
-- Черга сповіщень для бекенду
--
-- Нова майбутня подія (з'явилась після підписки) + підписка на артиста
-- або ключове слово + канал увімкнений + ще не надсилали.
--   select * from public.notification_queue;
-- Після відправки: insert into notifications_sent (user_id, event_id, channel) ...
-- ---------------------------------------------------------------------

create view public.notification_queue
with (security_invoker = true)
as
with matches as (
  select s.user_id, e.id as event_id, min(s.created_at) as subscribed_at
  from public.subscriptions s
  join public.events e on (
       (s.kind = 'artist'  and exists (select 1 from public.event_artists ea
                                       where ea.event_id = e.id and ea.artist_id = s.artist_id))
    or (s.kind = 'keyword' and e.title ilike '%' || trim(s.keyword) || '%')
  )
  where e.status = 'scheduled'
    and e.starts_at > now()
    and e.first_seen_at >= s.created_at
  group by s.user_id, e.id
),
channels as (
  select m.user_id, m.event_id, 'email'::public.notification_channel as channel, u.email::text as address
  from matches m
  join public.profiles p on p.id = m.user_id and p.email_alerts
  join auth.users u on u.id = m.user_id
  union all
  select m.user_id, m.event_id, 'telegram'::public.notification_channel, t.chat_id::text
  from matches m
  join public.profiles p on p.id = m.user_id and p.telegram_alerts
  join public.telegram_links t on t.user_id = m.user_id
)
select c.user_id, c.event_id, c.channel, c.address, e.title, e.starts_at, e.ticket_url, v.name as venue_name
from channels c
join public.events e on e.id = c.event_id
left join public.venues v on v.id = e.venue_id
where not exists (
  select 1 from public.notifications_sent n
  where n.user_id = c.user_id and n.event_id = c.event_id and n.channel = c.channel
);

-- ---------------------------------------------------------------------
-- Доступ (RLS): кожен бачить і змінює лише своє
-- ---------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.telegram_links       enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.notifications_sent   enable row level security;

create policy "own profile: read"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own telegram: read"   on public.telegram_links for select to authenticated using ((select auth.uid()) = user_id);
create policy "own telegram: unlink" on public.telegram_links for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own link token: create" on public.telegram_link_tokens for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own link token: read"   on public.telegram_link_tokens for select to authenticated using ((select auth.uid()) = user_id);

create policy "own subscriptions: read"   on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "own subscriptions: add"    on public.subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own subscriptions: remove" on public.subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own notifications: read" on public.notifications_sent for select to authenticated using ((select auth.uid()) = user_id);

-- черга з email-адресами — тільки для бекенду (service_role)
revoke all on public.notification_queue from anon, authenticated;
