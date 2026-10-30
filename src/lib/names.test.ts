import { describe, expect, it } from 'vitest'
import { nameFromEmail } from './names'

describe('nameFromEmail', () => {
  it('drops the +tag and capitalizes', () => {
    expect(nameFromEmail('zylence16+xplantest@gmail.com')).toBe('Zylence16')
  })
  it('splits on dots, underscores and dashes', () => {
    expect(nameFromEmail('jane.doe@example.com')).toBe('Jane Doe')
    expect(nameFromEmail('mary_ann-smith+work@example.com')).toBe('Mary Ann Smith')
    expect(nameFromEmail('a..b__c--d@x.io')).toBe('A B C D')
  })
  it('keeps existing inner casing', () => {
    expect(nameFromEmail('joshuaMColon@x.com')).toBe('JoshuaMColon')
  })
  it('falls back to Player', () => {
    expect(nameFromEmail(undefined)).toBe('Player')
    expect(nameFromEmail('')).toBe('Player')
    expect(nameFromEmail('+tag@x.com')).toBe('Player')
    expect(nameFromEmail('._-@x.com')).toBe('Player')
  })
  it('caps at 32 characters without a trailing space', () => {
    const n = nameFromEmail('abcdefghij.abcdefghij.abcdefghij.abcdefghij@x.com')
    expect(n.length).toBeLessThanOrEqual(32)
    expect(n).toBe(n.trim())
    expect(n).toBe('Abcdefghij Abcdefghij Abcdefghij')
  })
})
