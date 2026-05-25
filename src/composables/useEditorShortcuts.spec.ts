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

  it('keeps global shortcuts active from range sliders', async () => {
    const onAction = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup() {
          useEditorShortcuts({ onAction })
          return () => h('input', { type: 'range' })
        },
      }),
      { attachTo: document.body },
    )
    const slider = wrapper.get('input')

    slider.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    )

    await vi.waitFor(() => {
      expect(onAction).toHaveBeenCalledWith('transport.togglePlay')
    })
    wrapper.unmount()
  })

  it('does not dispatch character shortcuts from text inputs', async () => {
    const onAction = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup() {
          useEditorShortcuts({ onAction })
          return () => h('input', { type: 'text' })
        },
      }),
      { attachTo: document.body },
    )
    const input = wrapper.get('input')

    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', bubbles: true }),
    )

    expect(onAction).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
