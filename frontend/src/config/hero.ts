/**
 * Фото для слайдшоу в hero — файли з public/images/hero/.
 * Усі hero-1 … hero-10. Додали нове фото в папку (hero-11.jpg) → збільш length. Перше вантажиться з fetchPriority="high".
 */
export const HERO_PHOTOS: string[] = Array.from({ length: 10 }, (_, i) => `/images/hero/hero-${i + 1}.jpg`)

/** Скільки найближчих подій з офіційним image_url додати до слайдів */
export const HERO_EVENT_SLIDES = 3
/** Інтервал зміни фото, мс (crossfade 1.2 с — у .hero-slide в index.css) */
export const HERO_INTERVAL_MS = 6000
