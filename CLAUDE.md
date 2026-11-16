# Eventera — інструкції для Claude Code

## Продукт
Eventera — вебсайт, що збирає концерти й театральні події Львова з різних джерел
(Concert.ua, Karabas, сайти театрів і закладів, Telegram-канали) і показує їх в одному місці.
Користувач додає артистів у список «Я чекаю на…» і отримує сповіщення (Telegram / email),
щойно з'являється їхня подія у Львові. Кнопка донату — банка monobank на «Повернись живим».
Цільова аудиторія — студенти Львова. Повний опис: `design/Event_era.pdf`.

Команда: Anna Dizhak, Anastasiia Lem, Anastasiia Kvasovets.
- Роль 1 — парсер + AI-витягування (`backend/parser/`), дизайн у Figma.
- Роль 2 — frontend (`frontend/`), вхід, `infra/`, деплой на Vercel, README.  ← я працюю з тобою тут
- Роль 3 — Supabase-база + API + Telegram-бот (`backend/`), деплой на Render.
Демо — четвер, 19 листопада 2026. Пріоритет: працює і задеплоєно > ідеально.

## Що оцінюють (не порушуй)
1. У корені репо: `backend/`, `frontend/`, `infra/`, `README.md` (README пояснює незнайомій людині, що це, як запустити і як задеплоїти).
2. Прототип із реєстрацією та входом, задеплоєний, доступний по HTTPS.
3. Дані для звіту з фідбеком: таблиці `feedback` і `clicks`.
## Правила роботи
- НЕ змінюй файли в `backend/` (крім Dockerfile-ів в `infra/`, що на них посилаються) без мого прямого прохання — це код інших учасниць.
- Секрети тільки в `.env*` (у .gitignore). У frontend лише `VITE_SUPABASE_ANON_KEY`, ніколи `service_role`.
- Після кожної задачі: `npm run build` і `npm run lint` у `frontend/` без помилок, потім git commit з описом українською або англійською.
- Перед великою задачею — короткий план. Питай, якщо вимога неоднозначна.
- Сайт не має падати, якщо бекенд недоступний: API → Supabase напряму → моки (`src/mocks/events.ts`).
## Стек frontend
Vite + React + TypeScript, Tailwind CSS, react-router-dom, @tanstack/react-query,
@supabase/supabase-js (Auth: email+пароль, опційно Google), lucide-react, framer-motion.
Деплой: Vercel, Root Directory = `frontend`, SPA rewrite у `frontend/vercel.json`.

Змінні середовища (frontend/.env.local):
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL, VITE_DONATE_URL,
VITE_TELEGRAM_BOT_URL, VITE_ENABLE_GOOGLE

## Маршрути
- `/` — головна: hero + плитки «Задонать!» / «Сповіщення в Telegram» + «Цього тижня у Львові» + афіша з фільтрами
- `/event/:id` — сторінка події
- `/waitlist` — «Я чекаю на…» (тільки для залогінених)
- `/auth` (`?mode=signup`), `/auth/callback`, `/auth/reset`
- `/support` — підтримати збір
## Дані (Supabase)
events: id, title, artist, category (concert|theatre|festival|opera|other), genre, starts_at (timestamptz),
venue, address, price_min, price_max, is_free, ticket_url, source, image_url (nullable — офіційне фото з сайту),
description, badge (few_tickets|new|null), dedupe_key (unique), created_at
profiles: id (= auth.users.id), name, telegram_chat_id, telegram_link_token, notify_telegram, notify_email, remind_day_before, max_price
subscriptions: id, user_id, artist_name, created_at
feedback: id, user_id (nullable), rating (1–5), liked, disliked, would_pay (yes|maybe|no), page, created_at
clicks: id, user_id (nullable), kind (donate|subscribe|ticket|telegram), event_id (nullable), created_at
SQL-схема: `infra/supabase/schema.sql` (ідемпотентна, з RLS).

## API Ролі 3 (якщо VITE_API_URL задано)
GET /api/events?period=week|month|season|year&category=&price_max=&free=&genre=&q=&limit=&offset=
GET /api/events/:id · GET /api/events/:id/similar · GET /api/stats
GET|POST|DELETE /api/subscriptions (Authorization: Bearer <supabase access_token>)
POST /api/telegram/link → { url: "https://t.me/eventera_bot?start=<token>" }

## Дизайн (джерело правди — PNG у `design/`)
- Фон пудровий ~#F5E9EC, картки ~#FFFBFA, радіус 20–24px, м'які тіні.
- Основний темно-сливовий ~#4A2A3F, футер ~#2E1B28; акцент кораловий ~#E8806A; лаванда ~#C9B6E4.
- Шрифти (Google Fonts, display=swap; лише ці чотири, інших не додавай):
  - **Prata** (subset cyrillic) — заголовки, логотип «eventera», назви подій, назви місяців («листопада»), ціни.
  - **Onest** (subset cyrillic, 400/500/600) — основний текст, кнопки, фільтри-пілюлі, бейджі, підписи, форми.
  - **Doto** (900) — великі піксельні цифри: число дати на картках і сторінці події, лічильник подій («6 подій»), цифри «47 / 03» у блоці «Цього тижня». У Doto немає кирилиці — лише цифри й знаки, жодних українських слів.
  - **Homemade Apple** — тільки рукописні англійські фрази «see you tonight, Lviv», «with love», «don't miss it».
  - Задай їх у tailwind.config як font-display (Prata), font-sans (Onest, за замовчуванням для body), font-pixel (Doto), font-script (Homemade Apple). Fallback: serif / system-ui / monospace / cursive.
- Декор: пунктирні концентричні кола, рукописні фрази «see you tonight, Lviv», «with love», «don't miss it».
- Увесь інтерфейс українською. Дати: Intl uk-UA, часовий пояс Europe/Kyiv. Ціни: «від 450 ₴», «Вхід вільний».
- Mobile-first: 375px — 1 колонка, планшет — 2, десктоп — 4 картки в ряд.
## Особливі вимоги
- Серце (донат) і літачок (Telegram) у плитках «вібрують» як телефон на беззвучному: тремтіння ~0.45 с, пауза ~2 с, по колу.
  ЖОДНОГО ЗВУКУ: без <audio>, Audio(), Web Audio, navigator.vibrate. Анімувати лише transform/opacity.
  Повага до prefers-reduced-motion.
- Текстура віджетів — «гелева» / soft-blur, як на `design/05-widget-texture.png`: плитка схожа на розмиту
  кольорову краплю. Яскраве насичене ядро (зміщене вниз-ліворуч від центру) м'яко розтікається до майже білих,
  пастельних країв; самі краї плитки злегка розмиті (feathered), без чіткої межі. Зверху вгорі-праворуч —
  світліший відблиск. Всередині біла м'яка внутрішня підсвітка. Загалом світло й повітряно, без темних тонів.
  Текст на плитці білий (Onest 500, легка text-shadow для контрасту), іконки — напівпрозорі білі (rgba 255,255,255,.35–.5).
  Фон сторінки навколо — пудровий з ледь помітним шумом (grain ~4%) і рідкою сіткою дрібних крапок.
  Реалізація — компонент `GelTile` (variant: donate | telegram | neutral):
```css
.gel { position: relative; border-radius: 36px; isolation: isolate; color: #fff; }
.gel__bg { position: absolute; inset: 0; border-radius: inherit; z-index: -1;
  background:
    radial-gradient(55% 50% at 38% 68%, var(--core) 0%, var(--mid) 45%, transparent 78%),
    radial-gradient(45% 40% at 78% 22%, var(--glow) 0%, transparent 70%),
    var(--edge);
  filter: blur(10px);              /* розмиті краї плитки, контент НЕ розмивається */
  box-shadow: inset 0 10px 30px rgba(255,255,255,.55), inset 0 -12px 30px rgba(255,255,255,.35); }
```
  Палітри (світліші за макет):
  - donate:   --core #F2708A, --mid #F8B0B9, --glow #FFD9D2, --edge #FFEFEC
  - telegram: --core #9A7DD3, --mid #C8B5EE, --glow #EDE4FF, --edge #F5F0FD
  - neutral:  --core #E6D6DE, --mid #F1E7EC, --glow #FFFFFF, --edge #FBF6F8 (текст тут сливовий, не білий)
  Де використовувати: плитки «Задонать!» і «Сповіщення в Telegram» на головній, блок «Цього тижня у Львові» (neutral),
  картки «Йдеш на концерт — підтримай збір» і Telegram-нагадування на сторінці події, картка Telegram на /waitlist.
  Картки подій лишаються з фото. Hover: легке збільшення насиченості (filter: saturate(1.15)) і підйом на 4px.
- Фото в hero змінюється (crossfade кожні ~6 с) з `frontend/public/images/hero/`.
- Фото події: `image_url`, якщо є і завантажилось; інакше фото за категорією
  `/images/categories/{category}-{1..3}.jpg`, номер — детермінований хеш від id.
- Кнопки «Підписатися» (підписка на сповіщення) і «Задонатити» завжди поруч (компонент SupportActions).
- Плаваюча кнопка «Відгук» пише в `feedback`; кліки донату/підписки/квитків — у `clicks`.
 