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
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL (поки порожня), VITE_BACKEND_URL, VITE_DONATE_URL,
VITE_VIP_PAY_URL (банка «Eventera VIP»), VITE_VIP_NOTE (куди йдуть кошти VIP; порожньо → дефолтний текст),
VITE_TELEGRAM_BOT_URL (https://t.me/Eventera_lviv_bot), VITE_ENABLE_GOOGLE

## Маршрути
- `/` — головна: hero + плитки «Задонать!» / «Сповіщення в Telegram» + «Цього тижня у Львові» + афіша з фільтрами.
  Афіша показує всі події з пагінацією по 12 (useInfiniteQuery + range, кнопка «Показати ще події»);
  лічильник «N подій» — загальна кількість за фільтрами (count: 'exact'), зміна фільтрів скидає пагінацію.
- `/event/:id` — сторінка події
- `/waitlist` — «Я чекаю на…» (тільки для залогінених)
- `/auth` (`?mode=signup`), `/auth/callback`, `/auth/reset`
- `/support` — два блоки: «Донат на «Повернись живим»» (банка, QR qrcode.react, лічильник donate_clicks_count()) і «VIP-підписка» (тарифи + SupportActions). Пункт навігації «Підтримати».
## Дані (Supabase)
Основна схема — міграції Ролі 3 у `supabase/migrations/` (не змінювати; фронт підлаштовується під неї).
Моя частина — `infra/supabase/schema.sql` (feedback, clicks, RPC), накатується після міграцій.

Фронт читає події з view **event_feed** (тільки читання):
id (bigint), slug, title, description, category (concert|theatre|festival|opera|other), status (scheduled|postponed|cancelled),
starts_at, ends_at (timestamptz), is_all_day, price_min, price_max, currency, is_free (generated: price_max = 0),
ticket_status (unknown|available|few_left|sold_out), image_url (nullable — офіційне фото з сайту), ticket_url,
first_seen_at, is_new (за останні 3 дні), venue_id, venue_name, venue_address,
artists jsonb [{id, name, slug}], genres jsonb [{slug, name}], sources jsonb [{source, url, price_min}].
Бейдж на картці рахується на фронті: ticket_status = few_left → «Мало квитків», інакше is_new → «Нове».
Базові таблиці: events, venues, artists (name, slug, aliases[]), genres (slug — для фільтра), event_artists, event_genres,
event_sources, sources. Пише в них тільки service_role (парсер / бекенд).

profiles: id (= auth.users.id), display_name, email_alerts, telegram_alerts, created_at, updated_at
(+ vip_until timestamptz — додає Роль 3; поки колонки немає, усі безкоштовні — AuthProvider читає select('*')).
Створюється тригером handle_new_user(): ім'я береться з raw_user_meta_data.display_name →
у `supabase.auth.signUp` передавати `options.data.display_name`.
subscriptions («Я чекаю на…»): id, user_id, kind (artist|event|keyword), artist_id | event_id | keyword (рівно одне), created_at.
Додаємо так: є артист у `artists` (назва або aliases) → kind='artist' + artist_id; немає → kind='keyword'.
telegram_links: user_id, chat_id, username · telegram_link_tokens: token, user_id, expires_at (15 хв).
notifications_sent, notification_queue — тільки бекенд.

feedback: id, user_id (nullable), rating (1–5), liked, disliked, would_pay (yes|maybe|no), page, created_at
clicks: id, user_id (nullable), kind (donate|subscribe|ticket|telegram|vip_pay), event_id (nullable → events.id), created_at
(subscribe — кнопка VIP «Підписатися»; vip_pay — «Оплатити 39 ₴»; дзвіночок «Я чекаю на…» кліків не пише)
vip_requests: id, user_id → auth.users, email, created_at, status (pending|approved|rejected, default pending).
RLS: feedback і clicks — insert для всіх (user_id null або свій), select нікому з anon/authenticated.
vip_requests — insert (лише свій, status=pending) і select лише своїх рядків. Підтвердження VIP — вручну, infra/README.md.
RPC `donate_clicks_count()` — кількість кліків «Задонатити» (для /support).

## API Ролі 3 (якщо VITE_API_URL задано)
GET /api/events?period=week|month|season|year&category=&price_max=&free=&genre=&q=&limit=&offset=
GET /api/events/:id · GET /api/events/:id/similar · GET /api/stats
GET|POST|DELETE /api/subscriptions (Authorization: Bearer <supabase access_token>)

## Telegram-бот @Eventera_lviv_bot (бекенд Ролі 3, `VITE_BACKEND_URL`)
`VITE_BACKEND_URL` = https://eventera-api-hbgc.onrender.com — поки лише для прив'язки Telegram (VITE_API_URL для цього НЕ використовуємо).
POST ${VITE_BACKEND_URL}/api/telegram/link (Authorization: Bearer <access_token>) → { url: "https://t.me/Eventera_lviv_bot?start=<token>" }.
Уся дія — `linkTelegram()` у `src/lib/api.ts`, у компонентах — хук `useTelegramLink()` (`src/lib/use-telegram-link.ts`):
- гість → /auth?mode=signup&next=<поточна сторінка>;
- залогінений → порожня вкладка відкривається синхронно в onClick (щоб не заблокував попап), потім POST, url підставляється у вкладку;
  на кнопці спінер «Прокидаємо бота…» (Render засинає, перший запит до ~50 с), таймаут 60 с;
- помилка / таймаут → тост, та сама вкладка відкриває VITE_TELEGRAM_BOT_URL;
- завжди logClick('telegram').
Використовувати всюди, де є «Сповіщення в Telegram»: головна, футер, сторінка події, /waitlist, модалка «Підписатися».

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
  Текст на плитках темно-сливовий (заголовки плиток — Prata, як на макеті): білий не читається на світлих краях.
  Напівпрозорі білі іконки (rgba 255,255,255,.35–.5) — лише на насиченому ядрі (серце, кружечок літачка).
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
  - neutral:  --core #E6D6DE, --mid #F1E7EC, --glow #FFFFFF, --edge #FBF6F8 (текст сливовий, як і на інших плитках)
  Де використовувати: плитки «Задонать!» і «Сповіщення в Telegram» на головній, блок «Цього тижня у Львові» (neutral),
  картки «Йдеш на концерт — підтримай збір» і Telegram-нагадування на сторінці події, картка Telegram на /waitlist.
  Картки подій лишаються з фото. Hover: легке збільшення насиченості (filter: saturate(1.15)) і підйом на 4px.
- Фото в hero змінюється (crossfade кожні ~6 с) з `frontend/public/images/hero/`.
- Фото події: `image_url`, якщо є і завантажилось; інакше фото за категорією
  `/images/categories/{category}-{1..3}.jpg`, номер — детермінований хеш від id.
- **SupportActions** (`src/components/SupportActions.tsx`): «Задонатити» (коралова, з серцем, ЛІВОРУЧ) і «Підписатися»
  (сливова, підпис «VIP · 39 ₴/міс»; для VIP — «VIP до {дата}», ПРАВОРУЧ).
  **ПРАВИЛО: пара Задонатити + Підписатися — один раз на сторінці, біля блоку донату; Задонатити ліворуч, Підписатися праворуч.**
  Футер (tone="dark") не рахується. Зараз: головна (під плитками: коралова під рожевою, сливова під фіолетовою),
  сторінка події (лише блок донату «Йдеш на концерт…»), /waitlist (лише «Підтримати збір» в «Акаунті»), /support.
  Telegram-блоки — лише зі своєю кнопкою «Підключити», без SupportActions.
- Серце донату — `DonateHeart` (`src/components/ui/VibratingIcon.tsx`): суцільне матове #D2584A, без контуру й градієнта,
  вібрує й пульсує; спільне для плитки «Задонать!», блоку донату на сторінці події і /support.
- Свіжість: profile, subscriptions, telegram_links, vip_requests, налаштування сповіщень — `FRESH_QUERY`
  (`src/lib/fresh-query.ts`: staleTime 10 с, refetchOnWindowFocus 'always'), бо змінюються ботом / SQL.
- **«Підписатися» = платна VIP-підписка 39 ₴/міс.** Сповіщення про нові події (Telegram/email) — безкоштовні.
  **«Задонатити» = донат на «Повернись живим»** (VITE_DONATE_URL), окремо від VIP. Не плутати в текстах.
  Тарифи (компонент `TariffTable`, табличка «Безкоштовно / VIP»):
  - Безкоштовно: «Я чекаю на…» до 3 артистів; сповіщення в Telegram і на email, щойно з'явилася подія.
  - VIP 39 ₴/міс: необмежений список; нагадування за день до події; ліміт ціни для сповіщень (300 / 500 / 1000 ₴); бейдж VIP біля аватара.
  Модалка VIP — `useVip().openVip(reason?)` (`VipProvider` у Layout), завжди logClick('subscribe'):
  гість → /auth?mode=signup&next=<поточна>&vip=1, після входу модалка відкривається сама;
  крок 1 «Оплатити 39 ₴» → VITE_VIP_PAY_URL + logClick('vip_pay') + email для коментаря з «Скопіювати»;
  крок 2 «Я оплатив(-ла)» → insert у vip_requests → «Перевіряємо оплату — до 24 годин».
  VIP активний, якщо profiles.vip_until > now(). Ліміт 3 — у `useSubscriptionActions().add`;
  на /waitlist «Нагадати за день» і «Ліміт ціни» для не-VIP неактивні з бейджем «VIP» і відкривають модалку.
- Плаваюча кнопка «Відгук» (`FeedbackButton`): оцінка 1–5, що сподобалось, що заважало, чи оформив(-ла) би VIP
  (yes|maybe|no) → `feedback` зі сторінкою. Новим акаунтам через 2 хв після реєстрації — один раз підказка.
  Кліки донату/VIP/квитків/Telegram — у `clicks`.
 