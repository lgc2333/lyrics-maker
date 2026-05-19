import { describe, expect, it } from 'vitest'

import { normalizeKeystroke } from './keystroke'

describe('normalizeKeystroke', () => {
  it('uppercases single-char keys', () => {
    expect(normalizeKeystroke(new KeyboardEvent('keydown', { key: 'z' }))).toBe('Z')
  })

  it('passes through multi-char keys', () => {
    expect(normalizeKeystroke(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(
      'Enter',
    )
  })

  it('adds Ctrl modifier', () => {
    expect(
      normalizeKeystroke(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })),
    ).toBe('Ctrl+Z')
  })

  it('adds multiple modifiers in canonical order', () => {
    expect(
      normalizeKeystroke(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }),
      ),
    ).toBe('Ctrl+Shift+Z')
  })

  it('returns Meta+C for Cmd+C on macOS', () => {
    expect(
      normalizeKeystroke(new KeyboardEvent('keydown', { key: 'c', metaKey: true })),
    ).toBe('Meta+C')
  })

  it('returns Meta+Shift+Z for Cmd+Shift+Z', () => {
    expect(
      normalizeKeystroke(
        new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }),
      ),
    ).toBe('Meta+Shift+Z')
  })

  it('returns null when isComposing is true (IME active)', () => {
    expect(
      normalizeKeystroke(new KeyboardEvent('keydown', { key: 'z', isComposing: true })),
    ).toBeNull()
  })

  it('places Meta before Ctrl in modifier order', () => {
    expect(
      normalizeKeystroke(
        new KeyboardEvent('keydown', {
          key: 'z',
          metaKey: true,
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toBe('Meta+Ctrl+Shift+Z')
  })
})
