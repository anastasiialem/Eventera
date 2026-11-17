# База даних (Supabase / Postgres)

- `migrations/` — схема. Кожна зміна йде новим файлом, старі не редагуємо.
- `seed.sql` — демо-події з макета, тільки для локальної розробки.

## Як застосувати

Через Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push          # накотити міграції на хмарний проєкт
supabase db reset         # локально: міграції + seed.sql
```

Або вручну: відкрити SQL Editor у Supabase і виконати файл з `migrations/`.

## Таблиці

| Таблиця | Що зберігає |
|---|---|
| `events` | одна подія (навіть якщо знайдена на кількох сайтах) |
| `event_sources` | де саме знайдено подію: сайт, посилання на квитки, ціна, сирий результат AI (`raw`) |
| `venues` | площадки |
| `artists` | артисти + `aliases` для зіставлення різних написань |
| `genres`, `event_genres` | жанри для фільтра |
| `event_artists` | хто виступає (`position = 0` — хедлайнер) |
| `sources` | сайти-джерела (`concert_ua`, `karabas`, …) |

### Користувачі (`20261116140000_users_schema.sql` + 150000 + 160000)

| Таблиця | Що зберігає |
|---|---|
| `auth.users` | вбудована таблиця Supabase: email, пароль, вхід. Ми її не змінюємо |
| `profiles` | наш профіль, створюється тригером при реєстрації: `email` (копія з auth, змінювати напряму не можна), `email_alerts`, `telegram_alerts`, `remind_day_before` («Нагадати за день до події»), `max_price` («Тільки події до N ₴», null = без ліміту) |
| `subscriptions` | «Я чекаю на…»: `artist`, `event` або `keyword` (шукає в назві події **і** в іменах/aliases артистів, напр. «Лускунчик» чи «Скрябін») |
| `telegram_links` | `chat_id` користувача в боті |
| `telegram_link_tokens` | одноразові токени для `t.me/<bot>?start=<token>` (живуть 15 хв) |
| `notifications_sent` | що вже надіслано (user, event, channel, kind = `new_event` / `reminder`), щоб не слати двічі |

Дві черги для бекенду (читати може тільки `service_role`), обидві повертають кому, куди (email / chat_id) і про яку подію:

- `notification_queue` — «з'явилась нова подія»: лише події, що з'явились **після** підписки, і з урахуванням `max_price` (подію з невідомою ціною не відкидаємо). Після відправки: `insert into notifications_sent (user_id, event_id, channel) ...` (kind = `new_event` за замовчуванням).
- `reminder_queue` — «завтра подія»: події з особистого списку (`subscriptions.kind = 'event'`), що починаються в найближчі 24 години, якщо в профілі `remind_day_before` і активний VIP. Перевіряти, наприклад, щогодини; після відправки — той самий insert з `kind = 'reminder'`.

RLS: кожен користувач бачить і змінює лише свої профіль, підписки та прив'язку Telegram.

`event_feed` — готова view для стрічки: подія + площадка + артисти + жанри + джерела + `is_new` (з'явилась за останні 3 дні).

## Як записувати події (для того, хто робить парсер)

Коди сайтів уже є в таблиці `sources`: `karabas`, `concert_ua`, `kontramarka`, `lviv_travel`. Жанри — у `genres`.

1. Знайти або створити `venue` та `artists`.
2. Якщо `(source_id, external_id)` уже є в `event_sources`, оновити ціну і `last_seen_at`.
3. Інакше перевірити дублікат з іншого сайту:
   `select * from find_duplicate_event(venue_id, starts_at, title, is_all_day);`
   (той самий час початку + схожа назва; площадку не порівнюємо, бо сайти пишуть її по-різному).
   Якщо знайшовся, додати лише рядок в `event_sources`. Якщо ні, створити нову `events`.

Час завжди записувати з часовою зоною (`timestamptz`). Увага: у JSON-LD Karabas київський час записаний як UTC (концерт о 19:00 там `21:00+02:00`), тож без виправлення події Karabas не склеяться з іншими сайтами.

Для сповіщень важливо, щоб у кожної події були заповнені `event_artists`: підписки «Я чекаю на артиста» шукають саме там.

Писати може тільки `service_role` (ключ лише на сервері / в GitHub Actions). `anon` і `authenticated` можуть тільки читати, колонка `raw` їм недоступна.

## VIP (39 ₴/міс)

`profiles.vip_until` — до коли діє VIP (`null` — безкоштовний тариф). Користувач змінити її не може (немає прав на колонку + тригер `protect_vip_until`). Ліміт ціни (`max_price`) і нагадування за день працюють лише поки `vip_until > now()`; безкоштовно — до 3 артистів/слів у «Я чекаю на…» (перевіряють сайт і бот).

Видати VIP після оплати (SQL Editor):

```sql
update public.profiles set vip_until = now() + interval '1 month' where email = 'user@example.com';
```
