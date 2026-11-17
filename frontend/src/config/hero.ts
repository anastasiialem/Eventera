/**
 * Фото для слайдшоу в hero — файли з public/images/hero/.
 * Додали нове фото в папку → допиши шлях сюди. Перше вантажиться з fetchPriority="high".
 */
export const HERO_PHOTOS: string[] = ['/images/hero/hero-1.jpg', '/images/hero/hero-2.jpg', '/images/hero/hero-3.jpg']

/** Скільки найближчих подій з офіційним image_url додати до слайдів */
export const HERO_EVENT_SLIDES = 3
/** Інтервал зміни фото, мс (crossfade 1.2 с — у .hero-slide в index.css) */
export const HERO_INTERVAL_MS = 6000
