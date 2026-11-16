-- Демо-дані з макета головної сторінки. Тільки для локальної розробки:
-- `supabase db reset` накочує міграції, а потім цей файл.
-- Ціни, дати й джерела вигадані.

insert into public.sources (code, name, base_url) values
  ('concert_ua',   'Concert.ua',    'https://concert.ua'),
  ('karabas',      'Karabas',       'https://lviv.karabas.com'),
  ('zankovetska',  'Сайт театру',   'https://zankovetska.com.ua'),
  ('opera_lviv',   'Сайт опери',    'https://opera.lviv.ua'),
  ('telegram',     'Telegram',      null)
on conflict (code) do nothing;

insert into public.venues (name, slug, address) values
  ('Палац мистецтв',                       'palats-mystetstv',  'вул. Коперника, 17'),
  ('Театр ім. Марії Заньковецької',        'teatr-zankovetskoi', 'вул. Лесі Українки, 1'),
  ('!FESTrepublic',                        'festrepublic',      'вул. Старознесенська, 24-26'),
  ('Львівська національна опера',          'lvivska-opera',     'просп. Свободи, 28'),
  ('Площа Ринок',                          'ploshcha-rynok',    'пл. Ринок'),
  ('Malevych',                             'malevych',          'вул. Конюшинна, 3');

insert into public.artists (name, slug, aliases) values
  ('Жадан і Собаки', 'zhadan-i-sobaky', '{"Zhadan i Sobaky","Жадан и Собаки"}'),
  ('Один в каное',   'odyn-v-kanoe',    '{"Odyn v kanoe"}'),
  ('Шмальгаузен',    'shmalgauzen',     '{"Shmalgauzen"}');

insert into public.genres (slug, name) values
  ('rock',      'Рок'),
  ('indie',     'Інді'),
  ('drama',     'Драма'),
  ('classical', 'Класика'),
  ('ballet',    'Балет'),
  ('fair',      'Ярмарок')
on conflict (slug) do nothing;

insert into public.events
  (title, slug, category, starts_at, is_all_day, venue_id, price_min, price_max, ticket_status, first_seen_at)
values
  ('Жадан і Собаки', 'zhadan-i-sobaky-2026-11-21', 'concert',
   '2026-11-21 19:00 Europe/Kyiv', false,
   (select id from public.venues where slug = 'palats-mystetstv'), 450, 1200, 'few_left', now() - interval '10 days'),
  ('Вистава «Конотопська відьма»', 'konotopska-vidma-2026-11-22', 'theatre',
   '2026-11-22 12:00 Europe/Kyiv', false,
   (select id from public.venues where slug = 'teatr-zankovetskoi'), 200, 600, 'available', now() - interval '10 days'),
  ('Один в каное', 'odyn-v-kanoe-2026-11-26', 'concert',
   '2026-11-26 20:00 Europe/Kyiv', false,
   (select id from public.venues where slug = 'festrepublic'), 600, 1500, 'available', now() - interval '1 day'),
  ('Балет «Лускунчик»', 'luskunchyk-2026-11-28', 'opera',
   '2026-11-28 12:00 Europe/Kyiv', false,
   (select id from public.venues where slug = 'lvivska-opera'), 150, 900, 'available', now() - interval '10 days'),
  ('Різдвяний ярмарок', 'rizdvianyi-yarmarok-2026-12-05', 'festival',
   '2026-12-05 00:00 Europe/Kyiv', true,
   (select id from public.venues where slug = 'ploshcha-rynok'), 0, 0, 'available', now() - interval '10 days'),
  ('Шмальгаузен', 'shmalgauzen-2026-12-07', 'concert',
   '2026-12-07 19:30 Europe/Kyiv', false,
   (select id from public.venues where slug = 'malevych'), 500, 900, 'available', now() - interval '2 hours');

insert into public.event_artists (event_id, artist_id)
select e.id, a.id
from (values
  ('zhadan-i-sobaky-2026-11-21', 'zhadan-i-sobaky'),
  ('odyn-v-kanoe-2026-11-26',    'odyn-v-kanoe'),
  ('shmalgauzen-2026-12-07',     'shmalgauzen')
) as x(event_slug, artist_slug)
join public.events  e on e.slug = x.event_slug
join public.artists a on a.slug = x.artist_slug;

insert into public.event_genres (event_id, genre_id)
select e.id, g.id
from (values
  ('zhadan-i-sobaky-2026-11-21',     'rock'),
  ('konotopska-vidma-2026-11-22',    'drama'),
  ('odyn-v-kanoe-2026-11-26',        'indie'),
  ('luskunchyk-2026-11-28',          'ballet'),
  ('luskunchyk-2026-11-28',          'classical'),
  ('rizdvianyi-yarmarok-2026-12-05', 'fair'),
  ('shmalgauzen-2026-12-07',         'indie')
) as x(event_slug, genre_slug)
join public.events e on e.slug = x.event_slug
join public.genres g on g.slug = x.genre_slug;

-- «Жадан і Собаки» знайдено на двох сайтах: одна подія, два джерела
insert into public.event_sources (event_id, source_id, external_id, url, price_min, price_max)
select e.id, s.id, x.external_id, x.url, x.price_min, x.price_max
from (values
  ('zhadan-i-sobaky-2026-11-21',     'concert_ua',  'cu-1001',  'https://concert.ua/demo/zhadan',        450, 1200),
  ('zhadan-i-sobaky-2026-11-21',     'karabas',     'kb-555',   'https://lviv.karabas.com/demo/zhadan',  500, 1200),
  ('konotopska-vidma-2026-11-22',    'zankovetska', 'kv-22-11', 'https://zankovetska.com.ua/demo/konotop', 200, 600),
  ('odyn-v-kanoe-2026-11-26',        'karabas',     'kb-777',   'https://lviv.karabas.com/demo/kanoe',   600, 1500),
  ('luskunchyk-2026-11-28',          'opera_lviv',  'op-2811',  'https://opera.lviv.ua/demo/luskunchyk', 150, 900),
  ('rizdvianyi-yarmarok-2026-12-05', 'telegram',    'tg-4242',  'https://t.me/demo/4242',                0,   0),
  ('shmalgauzen-2026-12-07',         'concert_ua',  'cu-2002',  'https://concert.ua/demo/shmalgauzen',   500, 900)
) as x(event_slug, source_code, external_id, url, price_min, price_max)
join public.events  e on e.slug = x.event_slug
join public.sources s on s.code = x.source_code;

update public.events e
set ticket_url = (select es.url from public.event_sources es where es.event_id = e.id order by es.price_min nulls last limit 1);
