-- =====================================================================
-- Eventera: VIP-підписка (39 ₴/міс)
--
--   profiles.vip_until — до коли діє VIP (null = безкоштовний тариф).
--   Змінюємо лише ми (SQL Editor / service_role), користувач — ніколи.
--
--   VIP-функції в чергах сповіщень:
--     • max_price (ліміт ціни) враховується лише для VIP;
--     • reminder_queue (нагадування за день) — лише для VIP.
--   Ліміт «до 3 артистів» для безкоштовних перевіряють сайт і бот.
--
-- Видати VIP:   update public.profiles set vip_until = now() + interval '1 month'
--               where email = '...';
-- =====================================================================

alter table public.profiles add column vip_until timestamptz;

-- Права на UPDATE видані лише на окремі колонки (див. 20261116150000), тож
-- vip_until змінити через API й так не можна. Тригер — друга лінія захисту
-- на випадок, якщо хтось колись видасть права на всю таблицю.
create function public.protect_vip_until() returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.vip_until is distinct from (case when tg_op = 'UPDATE' then old.vip_until end) then
    raise exception 'vip_until змінюється лише адміністраторами' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_vip_until
  before insert or update on public.profiles
  for each row execute function public.protect_vip_until();

-- ---------------------------------------------------------------------
-- Черга «з'явилась нова подія»: ліміт ціни — лише для VIP
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
    and (p.max_price is null
         or p.vip_until is null or p.vip_until <= now()     -- не VIP: ліміт не діє
         or e.price_min is null
         or e.price_min <= p.max_price)
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
-- Черга нагадувань «завтра подія»: лише для VIP
-- ---------------------------------------------------------------------

create or replace view public.reminder_queue
with (security_invoker = true)
as
with due as (
  select s.user_id, e.id as event_id
  from public.subscriptions s
  join public.events e on e.id = s.event_id
  join public.profiles p on p.id = s.user_id and p.remind_day_before and p.vip_until > now()
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
