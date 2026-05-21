import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AudioTransport } from '../../platform/audio/audio-transport'
import type { MetronomeScheduler } from '../../platform/audio/metronome'
import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from '../../stores/editor-store'
import AppShell from './AppShell.vue'

function createMockAudioTransport(): AudioTransport {
  let _playing = false
  let _currentTime = 0
  return {
    loadFile: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(async () => {
      _playing = true
    }),
    pause: vi.fn(() => {
      _playing = false
    }),
    seek: vi.fn((t: number) => {
      _currentTime = t
    }),
    getCurrentTime: vi.fn(() => _currentTime),
    getDuration: vi.fn(() => 120),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    getIsPlaying: vi.fn(() => _playing),
    destroy: vi.fn(),
  }
}

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
    fireLatchNow: vi.fn(),
    hasPendingLatch: vi.fn(() => _latchPending),
    getLoadError: vi.fn(() => null),
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
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders all phase-1 shell sections', () => {
    const wrapper = mount(AppShell)
    expect(wrapper.find('[data-testid="menu-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="transport-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="main-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(true)
  })

  it('renders timing panel by default and can switch to lyrics panel', async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))

    expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lyrics-panel"]').exists()).toBe(false)

    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lyrics-panel"]').exists()).toBe(true)
  })

  it('lyrics panel scaffold contains placeholder text', async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))

    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    expect(wrapper.find('[data-testid="lyrics-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('导入歌词或逐句输入以开始打轴')
  })

  it('dispatches undo on Ctrl+Z', async () => {
    mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('test')
    expect(store.project.lyrics).toHaveLength(1)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )
    await vi.waitFor(() => {
      expect(store.project.lyrics).toHaveLength(0)
    })
  })

  it('dispatches M to toggle metronome action', async () => {
    const mock = createMockMetronome()
    __overrideMetronomeFactory(() => mock.scheduler)

    mount(AppShell)
    const store = useEditorStore()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }))
    await vi.waitFor(() => {
      expect(store.metronomeState).toBe('on')
    })
  })

  it('theme toggle updates html data-theme attribute', async () => {
    const wrapper = mount(AppShell)
    await wrapper.get('[data-testid="theme-toggle"]').trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBeTruthy()
  })

  it('does not issue network requests while mounting shell icons', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    mount(AppShell)
    await Promise.resolve()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('contains hidden audio input for file import workflow', () => {
    const wrapper = mount(AppShell)
    expect(wrapper.find('[data-testid="audio-file-input"]').exists()).toBe(true)
  })

  it('opens audio picker when menu open-file action is clicked', async () => {
    const wrapper = mount(AppShell)
    const inputEl = wrapper.get('[data-testid="audio-file-input"]')
      .element as HTMLInputElement
    const clickSpy = vi.spyOn(inputEl, 'click')

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-audio"]').trigger('click')

    expect(clickSpy).toHaveBeenCalled()
  })

  it('defaults theme based on system preference', async () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(((
      query: string,
    ) => ({
      matches: query.includes('prefers-color-scheme'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia)

    const wrapper = mount(AppShell)
    await wrapper.vm.$nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    matchMediaSpy.mockRestore()
  })
})
