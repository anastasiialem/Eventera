-- =====================================================================
-- Eventera: схема подій
--
-- Одна подія (events) може прийти з кількох сайтів: кожне джерело
-- зберігається окремим рядком у event_sources, а сама подія лише раз.
-- Пишуть у ці таблиці тільки парсер і бекенд (service_role, RLS обходить),
-- фронт і анонімні користувачі можуть лише читати.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Довідники
-- ---------------------------------------------------------------------

create type public.event_category as enum (
  'concert',
  'theatre',
  'festival',
  'opera',     -- опера й балет
  'other'
);

create type public.ticket_status as enum (
  'unknown',
  'available',
  'few_left',  -- «Мало квитків»
  'sold_out'
);

create type public.event_status as enum (
  'scheduled',
  'postponed',
  'cancelled'
);

-- Сайти, з яких збираємо афішу
create table public.sources (
  id          smallint generated always as identity primary key,
  code        text not null unique,        -- 'concert_ua', 'karabas', 'opera_lviv'
  name        text not null,               -- показуємо на картці: «Concert.ua», «Сайт театру»
  base_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.venues (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  address     text,
  city        text not null default 'Львів',
  latitude    double precision,
  longitude   double precision,
  website     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.artists (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  -- інші написання для зіставлення: 'Zhadan i Sobaky', 'Жадан и Собаки'
  aliases     text[] not null default '{}',
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.genres (
  id    smallint generated always as identity primary key,
  slug  text not null unique,              -- 'rock', 'classical', 'drama'
  name  text not null                      -- 'Рок', 'Класика', 'Драма'
);

-- ---------------------------------------------------------------------
-- Події
-- ---------------------------------------------------------------------

create table public.events (
  id             bigint generated always as identity primary key,
  title          text not null,
  slug           text not null unique,
  description    text,
  category       public.event_category not null,
  status         public.event_status not null default 'scheduled',

  starts_at      timestamptz not null,
  ends_at        timestamptz,
  is_all_day     boolean not null default false,   -- «весь день» (ярмарки, фестивалі)

  venue_id       bigint references public.venues (id) on delete set null,

  -- мінімальна / максимальна ціна серед усіх джерел, у гривнях
  price_min      numeric(10, 2) check (price_min >= 0),
  price_max      numeric(10, 2) check (price_max >= 0),
  currency       char(3) not null default 'UAH',
  is_free        boolean generated always as (price_max = 0) stored,  -- «Вхід вільний»
  ticket_status  public.ticket_status not null default 'unknown',

  image_url      text,
  ticket_url     text,              -- головне посилання на квитки

  -- коли парсер уперше побачив подію: для бейджа «Нове» і для сповіщень
  first_seen_at  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint events_price_range check (price_max is null or price_min is null or price_max >= price_min),
  constraint events_time_range  check (ends_at is null or ends_at >= starts_at)
);

-- Одна подія з різних сайтів
create table public.event_sources (
  id           bigint generated always as identity primary key,
  event_id     bigint not null references public.events (id) on delete cascade,
  source_id    smallint not null references public.sources (id) on delete restrict,
  external_id  text not null,       -- id або URL події на сайті-джерелі
  url          text not null,       -- посилання на квитки саме на цьому сайті
  price_min    numeric(10, 2),
  price_max    numeric(10, 2),
  raw          jsonb,               -- що повернув AI-екстрактор, для дебагу
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (source_id, external_id)
);

create table public.event_artists (
  event_id   bigint not null references public.events (id) on delete cascade,
  artist_id  bigint not null references public.artists (id) on delete cascade,
  position   smallint not null default 0,   -- 0 = хедлайнер
  primary key (event_id, artist_id)
);

create table public.event_genres (
  event_id  bigint not null references public.events (id) on delete cascade,
  genre_id  smallint not null references public.genres (id) on delete cascade,
  primary key (event_id, genre_id)
);

-- ---------------------------------------------------------------------
-- Індекси
-- ---------------------------------------------------------------------

-- стрічка і фільтри за датою / типом / ціною
create index events_starts_at_idx          on public.events (starts_at);
create index events_category_starts_at_idx on public.events (category, starts_at);
create index events_price_min_idx          on public.events (price_min);
create index events_venue_id_idx           on public.events (venue_id);
create index events_first_seen_at_idx      on public.events (first_seen_at);

create index event_sources_event_id_idx on public.event_sources (event_id);
create index event_artists_artist_id_idx on public.event_artists (artist_id);  -- «хто чекає на цього артиста»
create index event_genres_genre_id_idx  on public.event_genres (genre_id);

-- пошук «Артист, вистава або місце» і пошук дублікатів
create index events_title_trgm_idx  on public.events  using gin (title extensions.gin_trgm_ops);
create index artists_name_trgm_idx  on public.artists using gin (name  extensions.gin_trgm_ops);
create index venues_name_trgm_idx   on public.venues  using gin (name  extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_set_updated_at  before update on public.events
  for each row execute function public.set_updated_at();
create trigger venues_set_updated_at  before update on public.venues
  for each row execute function public.set_updated_at();
create trigger artists_set_updated_at before update on public.artists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Пошук дублікату для парсера
--
-- Та сама подія з іншого сайту = точно той самий час початку + схожа назва.
-- Площадку не порівнюємо: сайти називають її по-різному
-- («Malevich Concert Arena» / «Арена «Малевич»»). Для подій без часу
-- (p_is_all_day) — та сама площадка і той самий день.
--
-- Схожість = найбільше з similarity і word_similarity в обидва боки, тож
-- «SUROV» ≈ «SUROV. Одна душа на двох», але
-- «Новорічний органний концерт» ≠ «Новорічний фортепіанний концерт».
--
-- Парсер викликає перед вставкою: якщо щось знайшлося — додає лише
-- новий рядок у event_sources замість нової події.
--   select * from public.find_duplicate_event(3, '2026-11-22 18:00+02', 'Конотопська відьма');
-- ---------------------------------------------------------------------

create function public.title_similarity(a text, b text) returns real
language sql
immutable
set search_path = ''
as $$
  select greatest(
    extensions.similarity(lower(a), lower(b)),
    extensions.word_similarity(lower(a), lower(b)),
    extensions.word_similarity(lower(b), lower(a))
  );
$$;

create function public.find_duplicate_event(
  p_venue_id   bigint,
  p_starts_at  timestamptz,
  p_title      text,
  p_is_all_day boolean default false,
  p_min_similarity real default 0.7
)
returns table (event_id bigint, title text, similarity real)
language sql
stable
set search_path = ''
as $$
  select e.id, e.title, public.title_similarity(e.title, p_title) as sim
  from public.events e
  where (
          e.starts_at = p_starts_at
       or ((p_is_all_day or e.is_all_day)
           and e.venue_id = p_venue_id
           and (e.starts_at at time zone 'Europe/Kyiv')::date = (p_starts_at at time zone 'Europe/Kyiv')::date)
        )
    and public.title_similarity(e.title, p_title) >= p_min_similarity
  order by sim desc
  limit 5;
$$;

-- ---------------------------------------------------------------------
-- Стрічка для фронту: подія + площадка + артисти + жанри + джерела
-- ---------------------------------------------------------------------

create view public.event_feed
with (security_invoker = true)
as
select
  e.id,
  e.slug,
  e.title,
  e.description,
  e.category,
  e.status,
  e.starts_at,
  e.ends_at,
  e.is_all_day,
  e.price_min,
  e.price_max,
  e.currency,
  e.is_free,
  e.ticket_status,
  e.image_url,
  e.ticket_url,
  e.first_seen_at,
  e.first_seen_at > now() - interval '3 days' as is_new,
  v.id   as venue_id,
  v.name as venue_name,
  v.address as venue_address,
  coalesce(
    (select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'slug', a.slug) order by ea.position)
       from public.event_artists ea join public.artists a on a.id = ea.artist_id
      where ea.event_id = e.id),
    '[]'::jsonb) as artists,
  coalesce(
    (select jsonb_agg(jsonb_build_object('slug', g.slug, 'name', g.name) order by g.name)
       from public.event_genres eg join public.genres g on g.id = eg.genre_id
      where eg.event_id = e.id),
    '[]'::jsonb) as genres,
  coalesce(
    (select jsonb_agg(jsonb_build_object('source', s.name, 'url', es.url, 'price_min', es.price_min) order by es.price_min nulls last)
       from public.event_sources es join public.sources s on s.id = es.source_id
      where es.event_id = e.id),
    '[]'::jsonb) as sources
from public.events e
left join public.venues v on v.id = e.venue_id;

-- ---------------------------------------------------------------------
-- Доступ (RLS): усі можуть читати, пише тільки service_role
-- ---------------------------------------------------------------------

alter table public.sources       enable row level security;
alter table public.venues        enable row level security;
alter table public.artists       enable row level security;
alter table public.genres        enable row level security;
alter table public.events        enable row level security;
alter table public.event_sources enable row level security;
alter table public.event_artists enable row level security;
alter table public.event_genres  enable row level security;

create policy "public read" on public.sources       for select using (true);
create policy "public read" on public.venues        for select using (true);
create policy "public read" on public.artists       for select using (true);
create policy "public read" on public.genres        for select using (true);
create policy "public read" on public.events        for select using (true);
create policy "public read" on public.event_sources for select using (true);
create policy "public read" on public.event_artists for select using (true);
create policy "public read" on public.event_genres  for select using (true);

-- сирі відповіді AI фронту не потрібні: відкриваємо всі колонки, крім raw
revoke select on public.event_sources from anon, authenticated;
grant select (id, event_id, source_id, external_id, url, price_min, price_max, first_seen_at, last_seen_at)
  on public.event_sources to anon, authenticated;
