import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'

import { DEFAULT_SHORTCUT_BINDINGS } from '../platform/shortcuts/defaults'
import { bindingsByKeystroke } from '../platform/shortcuts/overrides'
import type { ShortcutAction } from '../platform/shortcuts/registry'
import { useEditorShortcuts } from './useEditorShortcuts'

function defaultBindingsMap() {
  return computed(() => bindingsByKeystroke(DEFAULT_SHORTCUT_BINDINGS))
}

function mountShortcutHarness(options: {
  onAction: (action: ShortcutAction) => void | Promise<void>
  onError?: (error: unknown, action: ShortcutAction) => void
  paused?: () => boolean
}) {
  return mount(
    defineComponent({
      setup() {
        useEditorShortcuts({
          bindings: defaultBindingsMap(),
          paused: computed(() => options.paused?.() ?? false),
          onAction: options.onAction,
          onError: options.onError,
        })
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
          useEditorShortcuts({
            bindings: defaultBindingsMap(),
            paused: computed(() => false),
            onAction,
          })
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
          useEditorShortcuts({
            bindings: defaultBindingsMap(),
            paused: computed(() => false),
            onAction,
          })
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

  it('rebuilds bindings when the reactive map changes', async () => {
    const onAction = vi.fn()
    const overrideKey = ref<string>('Ctrl+Z')
    const bindings = computed(() => {
      const map = new Map<string, ShortcutAction>()
      map.set(overrideKey.value, 'history.undo')
      return map
    })

    const wrapper = mount(
      defineComponent({
        setup() {
          useEditorShortcuts({
            bindings,
            paused: computed(() => false),
            onAction,
          })
          return () => h('div')
        },
      }),
    )

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    await vi.waitFor(() => {
      expect(onAction).toHaveBeenCalledWith('history.undo')
    })

    onAction.mockClear()
    overrideKey.value = 'F1'
    await vi.waitFor(() => {
      // Wait for watch to flush.
      expect(bindings.value.get('F1')).toBe('history.undo')
    })

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(onAction).not.toHaveBeenCalled()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }))
    await vi.waitFor(() => {
      expect(onAction).toHaveBeenCalledWith('history.undo')
    })
    wrapper.unmount()
  })

  it('does not dispatch while paused', async () => {
    const onAction = vi.fn()
    const paused = ref(true)
    const wrapper = mount(
      defineComponent({
        setup() {
          useEditorShortcuts({
            bindings: defaultBindingsMap(),
            paused: computed(() => paused.value),
            onAction,
          })
          return () => h('div')
        },
      }),
    )

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(onAction).not.toHaveBeenCalled()

    paused.value = false
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    await vi.waitFor(() => {
      expect(onAction).toHaveBeenCalledWith('history.undo')
    })
    wrapper.unmount()
  })
})
