import { AuthWeakPasswordError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { authErrorMessage, passwordErrorMessage } from './auth-errors'

const CHARACTERS_MSG =
  'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789'

describe('authErrorMessage: weak_password', () => {
  it('length → мінімум символів (число з повідомлення)', () => {
    const err = new AuthWeakPasswordError('Password should be at least 8 characters.', 422, ['length'])
    expect(authErrorMessage(err)).toBe('Мінімум 8 символів.')
    const err10 = new AuthWeakPasswordError('Password should be at least 10 characters.', 422, ['length'])
    expect(authErrorMessage(err10)).toBe('Мінімум 10 символів.')
  })

  it('characters → які саме символи додати', () => {
    const err = new AuthWeakPasswordError(CHARACTERS_MSG, 422, ['characters'])
    expect(authErrorMessage(err)).toBe('Додай великі й малі літери і цифру.')
  })

  it('characters з символами → згадує символ', () => {
    const err = new AuthWeakPasswordError(`${CHARACTERS_MSG}, !@#$%^&*()_+-=[]{};'\\:"|<>?,./\`~`, 422, ['characters'])
    expect(authErrorMessage(err)).toBe('Додай великі й малі літери, цифру і символ (напр. ! або #).')
  })

  it('characters без переліку в повідомленні → загальна вимога', () => {
    const err = new AuthWeakPasswordError('Password is too weak', 422, ['characters'])
    expect(authErrorMessage(err)).toBe('Додай великі й малі літери, цифру або символ.')
  })

  it('pwned → зламаний пароль', () => {
    const err = new AuthWeakPasswordError('Password is known to be weak and easy to guess, please choose a different one.', 422, [
      'pwned',
    ])
    expect(authErrorMessage(err)).toBe('Цей пароль є в базах зламаних паролів — придумай інший.')
  })

  it('кілька причин → усі тексти', () => {
    const err = new AuthWeakPasswordError(`Password should be at least 8 characters. ${CHARACTERS_MSG}`, 422, ['length', 'characters'])
    expect(authErrorMessage(err)).toBe('Мінімум 8 символів. Додай великі й малі літери і цифру.')
  })

  it('reasons у сирій відповіді API (weak_password.reasons)', () => {
    expect(authErrorMessage({ code: 'weak_password', message: 'weak', weak_password: { reasons: ['pwned'] } })).toBe(
      'Цей пароль є в базах зламаних паролів — придумай інший.',
    )
  })

  it('невідома причина → загальний текст', () => {
    // нова причина, якої ще немає в типах supabase-js
    const err = new AuthWeakPasswordError('Password is weak', 422, ['something_new' as 'length'])
    expect(authErrorMessage(err)).toBe('Пароль занадто простий — спробуй довший із цифрами.')
  })

  it('без reasons — причина з тексту повідомлення', () => {
    expect(authErrorMessage({ code: 'weak_password', message: CHARACTERS_MSG })).toBe('Додай великі й малі літери і цифру.')
  })
})

describe('authErrorMessage: інші', () => {
  it('same_password', () => {
    const err = { code: 'same_password', message: 'New password should be different from the old password.' }
    expect(authErrorMessage(err)).toBe('Новий пароль має відрізнятися від старого.')
    expect(passwordErrorMessage(err)).toBe('Новий пароль має відрізнятися від старого.')
  })

  it('не парольна помилка → passwordErrorMessage = null', () => {
    const err = { code: 'invalid_credentials', message: 'Invalid login credentials' }
    expect(passwordErrorMessage(err)).toBeNull()
    expect(authErrorMessage(err)).toBe('Невірний email або пароль.')
  })
})
