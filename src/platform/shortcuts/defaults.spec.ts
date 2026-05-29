import { describe, expect, it } from 'vitest'

import { DEFAULT_SHORTCUT_BINDINGS } from './defaults'
import type { ShortcutAction } from './registry'

describe('dEFAULT_SHORTCUT_BINDINGS', () => {
  it('binds D to lyrics.mark', () => {
    expect(DEFAULT_SHORTCUT_BINDINGS['lyrics.mark']).toBe('D')
  })

  it('binds S to lyrics.mark2 as the secondary mark key', () => {
    expect(DEFAULT_SHORTCUT_BINDINGS['lyrics.mark2']).toBe('S')
  })

  it('matches the documented snapshot for every action', () => {
    const expected: Record<ShortcutAction, string | null> = {
      'history.undo': 'Ctrl+Z',
      'history.redo': 'Ctrl+Y',
      'project.save': 'Ctrl+S',
      'transport.togglePlay': 'Space',
      'transport.prevBeat': 'ArrowLeft',
      'transport.nextBeat': 'ArrowRight',
      'transport.prevBar': 'Shift+ArrowLeft',
      'transport.nextBar': 'Shift+ArrowRight',
      'transport.increasePlaybackRate': null,
      'transport.decreasePlaybackRate': null,
      'transport.resetPlaybackRate': null,
      'timing.tapBpm': 'B',
      'metronome.toggle': 'M',
      'lyrics.mark': 'D',
      'lyrics.mark2': 'S',
      'lyrics.markNoAdvance': 'Shift+D',
      'lyrics.nextLine': 'Enter',
      'lyrics.playLineInterval': 'C',
      'lyrics.playWordInterval': 'V',
      'lyrics.deleteLine': 'Delete',
      'lyrics.clearSelection': 'Escape',
      'lyrics.editWholeLine': 'Tab',
    }
    expect(DEFAULT_SHORTCUT_BINDINGS).toStrictEqual(expected)
  })

  it('does not assign duplicate keystrokes to multiple actions', () => {
    const used = new Map<string, ShortcutAction>()
    for (const [action, key] of Object.entries(DEFAULT_SHORTCUT_BINDINGS) as Array<
      [ShortcutAction, string | null]
    >) {
      if (key === null) continue
      expect(used.has(key), `Duplicate default keystroke: ${key}`).toBe(false)
      used.set(key, action)
    }
  })
})
