-- =====================================================================
-- Eventera: довідники (джерела афіш і жанри)
-- =====================================================================

-- Сайти-джерела афіш. Код (code) парсер використовує, щоб підписати, звідки подія
insert into public.sources (code, name, base_url) values
  ('karabas',     'Karabas',      'https://lviv.karabas.com'),
  ('concert_ua',  'Concert.ua',   'https://concert.ua'),
  ('kontramarka', 'Kontramarka',  'https://lviv.kontramarka.ua'),
  ('lviv_travel', 'Lviv.travel',  'https://lviv.travel')
on conflict (code) do nothing;

-- Жанри для фільтра «Усі жанри» (slug не змінювати, по ньому фільтрує фронт)
insert into public.genres (slug, name) values
  ('pop',        'Поп'),
  ('rock',       'Рок'),
  ('indie',      'Інді'),
  ('hip-hop',    'Хіп-хоп'),
  ('electronic', 'Електроніка'),
  ('jazz',       'Джаз'),
  ('folk',       'Фольк'),
  ('classical',  'Класика'),
  ('opera',      'Опера'),
  ('ballet',     'Балет'),
  ('drama',      'Драма'),
  ('comedy',     'Комедія'),
  ('musical',    'Мюзикл'),
  ('kids',       'Для дітей'),
  ('standup',    'Стендап'),
  ('fair',       'Ярмарок')
on conflict (slug) do nothing;
