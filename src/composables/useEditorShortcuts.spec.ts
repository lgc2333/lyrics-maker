import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { ShortcutAction } from '../platform/shortcuts/registry'
import { useEditorShortcuts } from './useEditorShortcuts'

function mountShortcutHarness(options: {
  onAction: (action: ShortcutAction) => void | Promise<void>
  onError?: (error: unknown, action: ShortcutAction) => void
}) {
  return mount(
    defineComponent({
      setup() {
        useEditorShortcuts(options)
        return () => h('div')
      },
    }),
  )
}

describe('useEditorShortcuts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dispatches registered shortcut actions', async () => {
    const onAction = vi.fn()
    const wrapper = mountShortcutHarness({ onAction })

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    await vi.waitFor(() => {
      expect(onAction).toHaveBeenCalledWith('history.undo')
    })
    wrapper.unmount()
  })

  it('captures async action rejection through onError hook', async () => {
    const onError = vi.fn()
    const wrapper = mountShortcutHarness({
      onAction: async () => {
        throw new Error('shortcut failed')
      },
      onError,
    })

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'history.undo')
    })
    wrapper.unmount()
  })
})
