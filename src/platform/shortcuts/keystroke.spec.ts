import { describe, expect, it } from 'vitest'
import { normalizeKeystroke } from './keystroke'

describe('normalizeKeystroke', () => {
  it('uppercases single-char keys', () => {
    expect(normalizeKeystroke(new KeyboardEvent('keydown', { key: 'z' }))).toBe('Z')
  })

  it('passes through multi-char keys', () => {
    expect(normalizeKeystroke(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe('Enter')
  })

  it('adds Ctrl modifier', () => {
    expect(normalizeKeystroke(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))).toBe('Ctrl+Z')
  })

  it('adds multiple modifiers in canonical order', () => {
    expect(normalizeKeystroke(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+Z')
  })
})
