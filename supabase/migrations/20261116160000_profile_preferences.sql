-- =====================================================================
-- Eventera: налаштування сповіщень з макета + пошук keyword по артистах
--
--   profiles.remind_day_before — «Нагадати за день до події»
--   profiles.max_price         — «Тільки події до 500 ₴» (null = без обмеження)
--   subscriptions kind='keyword' тепер збігається і з назвою події,
--   і з іменем (або іншим написанням) артиста.
--
-- Попередні міграції вже накочені в Supabase, тому це окремий файл.
-- =====================================================================

alter table public.profiles
  add column remind_day_before boolean not null default false,
  add column max_price integer check (max_price is null or max_price >= 0);

-- користувач може змінювати ці налаштування сам (як і решту, крім email)
grant update (remind_day_before, max_price) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- notifications_sent: розрізняємо «нова подія» і «нагадування»,
-- щоб про ту саму подію можна було надіслати обидва
-- ---------------------------------------------------------------------

create type public.notification_kind as enum ('new_event', 'reminder');

alter table public.notifications_sent
  add column kind public.notification_kind not null default 'new_event';
alter table public.notifications_sent drop constraint notifications_sent_pkey;
alter table public.notifications_sent add primary key (user_id, event_id, channel, kind);

-- ---------------------------------------------------------------------
-- Черга «з'явилась нова подія»
--   + keyword шукає і в назві, і серед артистів
--   + враховує max_price: подія підходить, якщо найдешевший квиток
--     не дорожчий за ліміт (подію з невідомою ціною не відкидаємо)
-- ---------------------------------------------------------------------

create or replace view public.notification_queue
with (security_invoker = true)
as
with matches as (
  select s.user_id, e.id as event_id, min(s.created_at) as subscribed_at
  from public.subscriptions s
  join public.events e on (
       (s.kind = 'artist' and exists (
          select 1 from public.event_artists ea
          where ea.event_id = e.id and ea.artist_id = s.artist_id))
    or (s.kind = 'keyword' and (
          e.title ilike '%' || trim(s.keyword) || '%'
          or exists (
            select 1
            from public.event_artists ea
            join public.artists a on a.id = ea.artist_id
            where ea.event_id = e.id
              and (a.name ilike '%' || trim(s.keyword) || '%'
                   or exists (select 1 from unnest(a.aliases) al where al ilike '%' || trim(s.keyword) || '%')))))
  )
  join public.profiles p on p.id = s.user_id
  where e.status = 'scheduled'
    and e.starts_at > now()
    and e.first_seen_at >= s.created_at
    and (p.max_price is null or e.price_min is null or e.price_min <= p.max_price)
  group by s.user_id, e.id
),
channels as (
  select m.user_id, m.event_id, 'email'::public.notification_channel as channel, p.email as address
  from matches m
  join public.profiles p on p.id = m.user_id and p.email_alerts and p.email is not null
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
    and n.kind = 'new_event'
);

revoke all on public.notification_queue from anon, authenticated;

-- ---------------------------------------------------------------------
-- Черга нагадувань «завтра подія»
--
-- Події, які користувач додав у свій список (subscriptions kind='event'),
-- що починаються в найближчі 24 години, якщо увімкнено remind_day_before.
-- Бекенд перевіряє цю чергу, наприклад, щогодини; після відправки:
--   insert into notifications_sent (user_id, event_id, channel, kind)
--   values (..., ..., ..., 'reminder');
-- ---------------------------------------------------------------------

create view public.reminder_queue
with (security_invoker = true)
as
with due as (
  select s.user_id, e.id as event_id
  from public.subscriptions s
  join public.events e on e.id = s.event_id
  join public.profiles p on p.id = s.user_id and p.remind_day_before
  where s.kind = 'event'
    and e.status = 'scheduled'
    and e.starts_at > now()
    and e.starts_at <= now() + interval '24 hours'
),
channels as (
  select d.user_id, d.event_id, 'email'::public.notification_channel as channel, p.email as address
  from due d
  join public.profiles p on p.id = d.user_id and p.email_alerts and p.email is not null
  union all
  select d.user_id, d.event_id, 'telegram'::public.notification_channel, t.chat_id::text
  from due d
  join public.profiles p on p.id = d.user_id and p.telegram_alerts
  join public.telegram_links t on t.user_id = d.user_id
)
select c.user_id, c.event_id, c.channel, c.address, e.title, e.starts_at, e.ticket_url, v.name as venue_name
from channels c
join public.events e on e.id = c.event_id
left join public.venues v on v.id = e.venue_id
where not exists (
  select 1 from public.notifications_sent n
  where n.user_id = c.user_id and n.event_id = c.event_id and n.channel = c.channel
    and n.kind = 'reminder'
);

revoke all on public.reminder_queue from anon, authenticated;
