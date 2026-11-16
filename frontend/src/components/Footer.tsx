import { Link } from 'react-router-dom'

const telegramUrl = import.meta.env.VITE_TELEGRAM_BOT_URL || 'https://t.me/eventera_bot'

export function Footer() {
  return (
    <footer className="mx-auto mb-4 w-[calc(100%-2rem)] max-w-page rounded-card bg-plum-dark px-6 py-10 text-white/75 sm:mb-6 sm:w-[calc(100%-3rem)] sm:px-10 sm:py-12">
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-3xl text-white">eventera</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            Афіша Львова, яка сама слідкує за твоїми артистами. Зроблено студентками у Львові.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-sans text-xs font-medium uppercase tracking-[.18em] text-white/50">Джерела</h2>
          <ul className="space-y-1.5 text-sm">
            <li>Concert.ua · Karabas</li>
            <li>Сайти театрів і закладів</li>
            <li>Telegram-канали з афішами</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-sans text-xs font-medium uppercase tracking-[.18em] text-white/50">Ми на зв'язку</h2>
          <ul className="space-y-1.5 text-sm font-medium">
            <li>
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-4 hover:text-lavender">
                Telegram-бот @eventera_bot
              </a>
            </li>
            <li>
              <a href="https://instagram.com/" target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-4 hover:text-lavender">
                Instagram
              </a>
            </li>
            <li>
              <Link to="/support" className="text-coral underline underline-offset-4 hover:brightness-110">
                Підтримати збір
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
