import { describe, expect, it, vi } from 'vitest'
import { createShortcutRegistry } from './registry'

describe('shortcut registry', () => {
  it('rejects conflicting shortcuts', () => {
    const registry = createShortcutRegistry()
    registry.register('Ctrl+Z', 'history.undo')
    const conflict = registry.register('Ctrl+Z', 'history.redo')
    expect(conflict.ok).toBe(false)
  })

  it('does not dispatch for unregistered keys', () => {
    const onAction = vi.fn()
    const registry = createShortcutRegistry()
    registry.dispatch('Ctrl+S', onAction)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('dispatches registered action', () => {
    const onAction = vi.fn()
    const registry = createShortcutRegistry()
    registry.register('Ctrl+Y', 'history.redo')
    registry.dispatch('Ctrl+Y', onAction)
    expect(onAction).toHaveBeenCalledWith('history.redo')
  })
})
