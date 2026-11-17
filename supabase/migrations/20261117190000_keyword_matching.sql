-- =====================================================================
-- Eventera: пошук за словом без лапок і розділових знаків
--
--   «Вистава Крик кохання» тепер знаходить «Вистава «Крик кохання»».
--   normalize_text: нижній регістр, усі розділові знаки й лапки → пробіл,
--   пробіли схлопуються.
--
--   upcoming_matches(artist_id | keyword) — майбутні події, що вже є в афіші
--   для артиста чи слова (бот показує їх одразу після додавання; сайт теж
--   може викликати: supabase.rpc('upcoming_matches', { p_keyword: '…' })).
-- =====================================================================

create function public.normalize_text(t text) returns text
language sql immutable parallel safe
as $$
  select trim(regexp_replace(lower(coalesce(t, '')), '[[:space:][:punct:]«»“”„‘’‚—–…№]+', ' ', 'g'))
$$;

-- Чи підходить подія під слово з «Я чекаю на…»: назва події, ім'я артиста або aliases.
create function public.keyword_matches_event(p_keyword text, p_event_id bigint) returns boolean
language sql stable
set search_path = ''
as $$
  with k as (select public.normalize_text(p_keyword) as kw)
  select k.kw <> '' and (
       public.normalize_text(e.title) like '%' || k.kw || '%'
    or exists (
         select 1
         from public.event_artists ea
         join public.artists a on a.id = ea.artist_id
         where ea.event_id = e.id
           and (public.normalize_text(a.name) like '%' || k.kw || '%'
                or exists (select 1 from unnest(a.aliases) al
                           where public.normalize_text(al) like '%' || k.kw || '%'))))
  from k
  join public.events e on e.id = p_event_id
$$;

-- ---------------------------------------------------------------------
-- Черга «з'явилась нова подія» (як у 20261117120000_vip.sql,
-- змінено лише збіг за словом)
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
    or (s.kind = 'keyword' and public.keyword_matches_event(s.keyword, e.id))
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
-- Події, що вже є в афіші для артиста або слова
-- ---------------------------------------------------------------------

create function public.upcoming_matches(p_artist_id bigint default null, p_keyword text default null,
                                        p_limit integer default 5)
returns table (id bigint, title text, starts_at timestamptz, status public.event_status, venue_name text)
language sql stable
set search_path = ''
as $$
  select e.id, e.title, e.starts_at, e.status, v.name
  from public.events e
  left join public.venues v on v.id = e.venue_id
  where e.status in ('scheduled', 'postponed')
    and e.starts_at > now()
    and (   (p_artist_id is not null and exists (
               select 1 from public.event_artists ea where ea.event_id = e.id and ea.artist_id = p_artist_id))
         or (p_keyword is not null and public.keyword_matches_event(p_keyword, e.id)))
  order by e.starts_at
  limit least(greatest(coalesce(p_limit, 5), 1), 20)
$$;
