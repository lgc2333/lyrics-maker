import { describe, expect, it } from 'vitest'

import { DEFAULT_SHORTCUT_BINDINGS } from './defaults'
import { bindingsByKeystroke, mergeBindings } from './overrides'
import type { ShortcutOverrides } from './overrides'

describe('mergeBindings', () => {
  it('returns defaults when overrides is empty', () => {
    const merged = mergeBindings(DEFAULT_SHORTCUT_BINDINGS, {})
    expect(merged).toStrictEqual(DEFAULT_SHORTCUT_BINDINGS)
  })

  it('replaces a default when override is a string', () => {
    const merged = mergeBindings(DEFAULT_SHORTCUT_BINDINGS, {
      'lyrics.mark2': 'Q',
    })
    expect(merged['lyrics.mark2']).toBe('Q')
    expect(merged['lyrics.mark']).toBe('D')
  })

  it('uses null when override explicitly clears the binding', () => {
    const merged = mergeBindings(DEFAULT_SHORTCUT_BINDINGS, {
      'lyrics.editWholeLine': null,
    })
    expect(merged['lyrics.editWholeLine']).toBeNull()
  })

  it('falls back to default when override key is missing (undefined)', () => {
    const overrides: ShortcutOverrides = {
      'lyrics.mark2': 'Q',
    }
    const merged = mergeBindings(DEFAULT_SHORTCUT_BINDINGS, overrides)
    expect(merged['lyrics.mark']).toBe('D')
  })

  it('ignores override keys that are not in the default map', () => {
    const merged = mergeBindings(DEFAULT_SHORTCUT_BINDINGS, {
      // Unknown action key — schema layer cannot narrow it
      'nonexistent.action': 'X',
    } as unknown as ShortcutOverrides)
    expect(Object.keys(merged)).toEqual(Object.keys(DEFAULT_SHORTCUT_BINDINGS))
  })

  it('returns a new object rather than mutating defaults', () => {
    const before = JSON.stringify(DEFAULT_SHORTCUT_BINDINGS)
    mergeBindings(DEFAULT_SHORTCUT_BINDINGS, { 'lyrics.mark': 'Q' })
    expect(JSON.stringify(DEFAULT_SHORTCUT_BINDINGS)).toBe(before)
  })
})

describe('bindingsByKeystroke', () => {
  it('builds a reverse index from effective bindings', () => {
    const index = bindingsByKeystroke(DEFAULT_SHORTCUT_BINDINGS)
    expect(index.get('D')).toBe('lyrics.mark')
    expect(index.get('S')).toBe('lyrics.mark2')
    expect(index.get('Ctrl+Z')).toBe('history.undo')
  })

  it('skips null keystrokes', () => {
    const merged = mergeBindings(DEFAULT_SHORTCUT_BINDINGS, {
      'lyrics.mark2': null,
    })
    const index = bindingsByKeystroke(merged)
    expect(index.has('S')).toBe(false)
    expect([...index.values()]).not.toContain('lyrics.mark2')
  })
})
