/**
 * Дані, які змінюються поза сайтом (Telegram-бот, видача VIP через SQL): profile, subscriptions,
 * telegram_links, vip_requests, налаштування сповіщень. Короткий staleTime + перечитування при
 * кожному поверненні на вкладку — після Telegram сайт оновиться сам.
 * Глобальний дефолт (афіша) у main.tsx не чіпаємо.
 */
export const FRESH_QUERY = {
  staleTime: 10_000,
  refetchOnWindowFocus: 'always',
} as const
