import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { DEFAULT_SHORTCUT_BINDINGS } from '../platform/shortcuts/defaults'
import type { ShortcutOverrides } from '../platform/shortcuts/overrides'
import { useShortcutBindings } from './useShortcutBindings'

interface Harness {
  overrides: ReturnType<typeof ref<ShortcutOverrides>>
  onChange: ReturnType<typeof vi.fn>
  onStatus: ReturnType<typeof vi.fn>
  bindings: ReturnType<typeof useShortcutBindings>
}

function makeHarness(initial: ShortcutOverrides = {}): Harness {
  const overrides = ref<ShortcutOverrides>({ ...initial })
  const onChange = vi.fn((next: ShortcutOverrides) => {
    overrides.value = next
  })
  const onStatus = vi.fn()
  const bindings = useShortcutBindings({
    initialOverrides: overrides,
    onChange,
    onStatus,
  })
  return { overrides, onChange, onStatus, bindings }
}

describe('useShortcutBindings · effectiveBindings', () => {
  it('returns defaults when overrides is empty', () => {
    const { bindings } = makeHarness()
    expect(bindings.effectiveBindings.value).toStrictEqual(DEFAULT_SHORTCUT_BINDINGS)
  })

  it('reflects overrides in effectiveBindings reactively', () => {
    const { bindings, overrides } = makeHarness()
    overrides.value = { 'lyrics.mark2': 'Q' }
    expect(bindings.effectiveBindings.value['lyrics.mark2']).toBe('Q')
  })

  it('omits null overrides from bindingsByKeystroke', () => {
    const { bindings, overrides } = makeHarness()
    overrides.value = { 'lyrics.mark2': null }
    expect(bindings.bindingsByKeystroke.value.has('S')).toBe(false)
  })
})

describe('useShortcutBindings · assignBinding', () => {
  let h: Harness
  beforeEach(() => {
    h = makeHarness()
  })

  it('returns sameBinding short-circuit when keystroke already maps to that action', () => {
    const result = h.bindings.assignBinding('lyrics.mark', 'D')
    expect(result).toEqual({ ok: false, reason: 'sameBinding' })
    expect(h.onChange).not.toHaveBeenCalled()
    expect(h.onStatus).not.toHaveBeenCalled()
  })

  it('writes a simple override when there is no conflict', () => {
    const result = h.bindings.assignBinding('lyrics.mark2', 'Q')
    expect(result).toEqual({ ok: true, reassignedFrom: null })
    expect(h.onChange).toHaveBeenCalledTimes(1)
    expect(h.onChange).toHaveBeenCalledWith({ 'lyrics.mark2': 'Q' })
    expect(h.onStatus).toHaveBeenCalledWith(
      'status.shortcuts.assigned',
      expect.objectContaining({ keystroke: 'Q' }),
    )
  })

  it('reassigns conflict by setting the previous owner to null in one onChange', () => {
    const result = h.bindings.assignBinding('lyrics.mark2', 'D')
    expect(result).toEqual({ ok: true, reassignedFrom: 'lyrics.mark' })
    expect(h.onChange).toHaveBeenCalledTimes(1)
    expect(h.onChange).toHaveBeenCalledWith({
      'lyrics.mark': null,
      'lyrics.mark2': 'D',
    })
    expect(h.onStatus).toHaveBeenCalledWith(
      'status.shortcuts.reassigned',
      expect.objectContaining({ keystroke: 'D' }),
    )
  })
})

describe('useShortcutBindings · clearBinding', () => {
  it('writes null override and emits cleared status', () => {
    const h = makeHarness()
    h.bindings.clearBinding('lyrics.editWholeLine')
    expect(h.onChange).toHaveBeenCalledWith({ 'lyrics.editWholeLine': null })
    expect(h.onStatus).toHaveBeenCalledWith(
      'status.shortcuts.cleared',
      expect.any(Object),
    )
  })
})

describe('useShortcutBindings · resetAction', () => {
  it('short-circuits when action is already at default', () => {
    const h = makeHarness()
    h.bindings.resetAction('lyrics.mark')
    expect(h.onChange).not.toHaveBeenCalled()
    expect(h.onStatus).not.toHaveBeenCalled()
  })

  it('removes the override key and emits reset status', () => {
    const h = makeHarness({ 'lyrics.mark': 'Q' })
    h.bindings.resetAction('lyrics.mark')
    expect(h.onChange).toHaveBeenCalledWith({})
    expect(h.onStatus).toHaveBeenCalledWith(
      'status.shortcuts.reset',
      expect.any(Object),
    )
  })

  it('displaces a conflicting action when restoring the default would collide', () => {
    // User had reassigned D away from lyrics.mark, then assigned D to history.undo via custom.
    const h = makeHarness({ 'lyrics.mark': null, 'history.undo': 'D' })
    h.bindings.resetAction('lyrics.mark')
    expect(h.onChange).toHaveBeenCalledTimes(1)
    expect(h.onChange).toHaveBeenCalledWith({ 'history.undo': null })
    expect(h.onStatus).toHaveBeenCalledWith(
      'status.shortcuts.reset',
      expect.any(Object),
    )
  })
})

describe('useShortcutBindings · resetAll', () => {
  it('short-circuits when there are no overrides', () => {
    const h = makeHarness()
    h.bindings.resetAll()
    expect(h.onChange).not.toHaveBeenCalled()
    expect(h.onStatus).not.toHaveBeenCalled()
  })

  it('clears all overrides and emits resetAll status', () => {
    const h = makeHarness({ 'lyrics.mark': 'Q', 'history.undo': 'F1' })
    h.bindings.resetAll()
    expect(h.onChange).toHaveBeenCalledWith({})
    expect(h.onStatus).toHaveBeenCalledWith('status.shortcuts.resetAll')
  })
})
