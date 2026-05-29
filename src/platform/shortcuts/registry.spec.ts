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

  it('unregister removes an existing binding', () => {
    const onAction = vi.fn()
    const registry = createShortcutRegistry()

    registry.register('Ctrl+Y', 'history.redo')
    registry.dispatch('Ctrl+Y', onAction)
    expect(onAction).toHaveBeenCalledWith('history.redo')

    onAction.mockClear()
    registry.unregister('Ctrl+Y')
    registry.dispatch('Ctrl+Y', onAction)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('does not dispatch when keystroke is null (IME composing)', () => {
    const onAction = vi.fn()
    const registry = createShortcutRegistry()
    registry.register('Ctrl+Z', 'history.undo')
    // @ts-expect-error testing null guard at runtime
    registry.dispatch(null, onAction)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('rebuild replaces all bindings atomically', () => {
    const onAction = vi.fn()
    const registry = createShortcutRegistry()

    registry.register('Ctrl+Z', 'history.undo')
    registry.rebuild(
      new Map<string, 'history.redo' | 'project.save'>([
        ['Ctrl+Y', 'history.redo'],
        ['Ctrl+S', 'project.save'],
      ]),
    )

    registry.dispatch('Ctrl+Z', onAction)
    expect(onAction).not.toHaveBeenCalled()

    registry.dispatch('Ctrl+Y', onAction)
    expect(onAction).toHaveBeenCalledWith('history.redo')

    registry.dispatch('Ctrl+S', onAction)
    expect(onAction).toHaveBeenCalledWith('project.save')
  })

  it('rebuild with an empty map clears all bindings', () => {
    const onAction = vi.fn()
    const registry = createShortcutRegistry()
    registry.register('Ctrl+Z', 'history.undo')

    registry.rebuild(new Map())

    registry.dispatch('Ctrl+Z', onAction)
    expect(onAction).not.toHaveBeenCalled()
  })
})
