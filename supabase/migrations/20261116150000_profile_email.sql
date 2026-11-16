-- =====================================================================
-- Eventera: email у profiles замість читання auth.users
--
-- У Supabase роль service_role не має права читати auth.users, тому
-- notification_queue падала з «permission denied for table users».
-- Тепер email копіюється в profiles тригерами (при реєстрації і при зміні
-- пошти), а черга бере його звідти.
-- =====================================================================

alter table public.profiles add column email text;

-- уже зареєстровані користувачі
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

-- при реєстрації: тепер профіль одразу з email
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
          new.email);
  return new;
end;
$$;

-- при зміні пошти в акаунті
create function public.handle_user_email_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- email змінюється лише через Supabase Auth, не напряму в profiles
-- (інакше можна вписати чужу пошту й слати туди сповіщення).
-- Supabase видає права на всю таблицю, тож забираємо їх і даємо лише потрібні колонки.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, email_alerts, telegram_alerts) on public.profiles to authenticated;

-- та сама черга, але email береться з profiles
create or replace view public.notification_queue
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
);

revoke all on public.notification_queue from anon, authenticated;
