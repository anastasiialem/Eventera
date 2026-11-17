import { describe, expect, it } from 'vitest'
import { CATEGORY_PHOTO_COUNT, categoryPhoto, normalizeCategory, photoCredit, pickEventImage } from './eventImage'

describe('normalizeCategory', () => {
  it('приймає канонічні категорії й синоніми з парсера без урахування регістру', () => {
    expect(normalizeCategory('concert')).toBe('concert')
    expect(normalizeCategory('Концерт')).toBe('concert')
    expect(normalizeCategory(' ВИСТАВА ')).toBe('theatre')
    expect(normalizeCategory('театр')).toBe('theatre')
    expect(normalizeCategory('Фестиваль')).toBe('festival')
    expect(normalizeCategory('опера')).toBe('opera')
    expect(normalizeCategory('Балет')).toBe('opera')
    expect(normalizeCategory('стендап')).toBe('other')
  })

  it('невідоме або не рядок → other', () => {
    expect(normalizeCategory('виставка')).toBe('other')
    expect(normalizeCategory('')).toBe('other')
    expect(normalizeCategory(null)).toBe('other')
    expect(normalizeCategory(42)).toBe('other')
  })
})

describe('categoryPhoto', () => {
  it('одна подія — завжди те саме фото', () => {
    const e = { id: 1234, category: 'concert' }
    expect(categoryPhoto(e)).toBe(categoryPhoto({ ...e }))
    expect(categoryPhoto({ id: '1234', category: 'Концерт' })).toBe(categoryPhoto(e))
  })

  it('номер у межах наявних файлів категорії', () => {
    for (let id = 1; id <= 200; id++) {
      const m = categoryPhoto({ id, category: 'opera' }).match(/^\/images\/categories\/opera-(\d+)\.jpg$/)
      expect(m).not.toBeNull()
      const n = Number(m![1])
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(CATEGORY_PHOTO_COUNT.opera)
    }
  })

  it('сусідні події однієї категорії отримують різні фото', () => {
    const photos = new Set(Array.from({ length: 12 }, (_, i) => categoryPhoto({ id: 100 + i, category: 'concert' })))
    expect(photos.size).toBe(CATEGORY_PHOTO_COUNT.concert)
  })

  it('категорія без власних фото не дає 404-шлях', () => {
    expect(categoryPhoto({ id: 7, category: 'стендап' })).toMatch(/^\/images\/categories\/concert-\d\.jpg$/)
  })
})

describe('pickEventImage', () => {
  const base = { id: 5, category: 'theatre' as const }

  it('є image_url → офіційне фото', () => {
    expect(pickEventImage({ ...base, image_url: 'https://site.ua/a.jpg' })).toEqual({
      src: 'https://site.ua/a.jpg',
      official: true,
    })
  })

  it('немає image_url або воно не завантажилось → фото за категорією', () => {
    const fallback = { src: categoryPhoto(base), official: false }
    expect(pickEventImage({ ...base, image_url: null })).toEqual(fallback)
    expect(pickEventImage({ ...base, image_url: '  ' })).toEqual(fallback)
    expect(pickEventImage({ ...base, image_url: 'https://site.ua/a.jpg' }, true)).toEqual(fallback)
  })
})

describe('photoCredit', () => {
  it('назва джерела, інакше домен картинки', () => {
    expect(
      photoCredit({ image_url: 'https://x.ua/a.jpg', sources: [{ source: 'Concert.ua', url: '', price_min: null }] }),
    ).toBe('Concert.ua')
    expect(photoCredit({ image_url: 'https://www.opera.lviv.ua/a.jpg', sources: [] })).toBe('opera.lviv.ua')
    expect(photoCredit({ image_url: null, sources: [] })).toBeNull()
  })
})
