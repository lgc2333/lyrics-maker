import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MetronomeScheduler } from '../../platform/audio/metronome'
import { __overrideMetronomeFactory, useEditorStore } from '../../stores/editor-store'
import AppShell from './AppShell.vue'

/**
 * Creates a mock MetronomeScheduler with controllable state for testing.
 */
function createMockMetronome(): {
  scheduler: MetronomeScheduler
  enabled: () => boolean
  latchPending: () => boolean
  setEnabledCalls: Array<boolean>
} {
  let _enabled = false
  let _latchPending = false
  const setEnabledCalls: Array<boolean> = []

  const scheduler: MetronomeScheduler = {
    setEnabled: vi.fn((value: boolean) => {
      setEnabledCalls.push(value)
      if (value) {
        _latchPending = false
      } else if (_enabled) {
        _latchPending = true
      }
      _enabled = value
    }),
    setSfxVolume: vi.fn(),
    syncToTimeline: vi.fn(),
    hasPendingLatch: vi.fn(() => _latchPending),
    destroy: vi.fn(),
  }

  return {
    scheduler,
    enabled: () => _enabled,
    latchPending: () => _latchPending,
    setEnabledCalls,
  }
}

describe('appShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders all phase-1 shell sections', () => {
    const wrapper = mount(AppShell)
    expect(wrapper.find('[data-testid="menu-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="transport-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="main-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(true)
  })

  it('renders timing panel by default and can switch to lyrics panel', async () => {
    const wrapper = mount(AppShell)
    expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lyrics-panel"]').exists()).toBe(false)

    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lyrics-panel"]').exists()).toBe(true)
  })

  it('lyrics panel scaffold contains placeholder text', async () => {
    const wrapper = mount(AppShell)
    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    expect(wrapper.find('[data-testid="lyrics-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('歌词编辑区')
  })

  it('dispatches undo on Ctrl+Z', () => {
    mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('test')
    expect(store.project.lyrics).toHaveLength(1)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    expect(store.project.lyrics).toHaveLength(0)
  })

  it('dispatches M to toggle metronome action', () => {
    const mock = createMockMetronome()
    __overrideMetronomeFactory(() => mock.scheduler)

    mount(AppShell)
    const store = useEditorStore()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }))
    expect(store.metronomeState).toBe('on')
  })
})
