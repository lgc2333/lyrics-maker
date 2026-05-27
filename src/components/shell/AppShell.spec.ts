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

const { mockSaveByShortcut, mockSaveAs, mockOpenProject } = vi.hoisted(() => ({
  mockSaveByShortcut: vi.fn(),
  mockSaveAs: vi.fn(),
  mockOpenProject: vi.fn(),
}))

vi.mock('../../composables/useProjectPersistence', () => ({
  useProjectPersistence: vi.fn(() => ({
    hasFileApi: () => true,
    saveByShortcut: mockSaveByShortcut,
    saveAs: mockSaveAs,
    openProject: mockOpenProject,
  })),
}))

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
    handlePlaybackPaused: vi.fn(),
    cancelPendingClicks: vi.fn(),
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
    mockSaveByShortcut.mockReset()
    mockSaveAs.mockReset()
    mockOpenProject.mockReset()
    mockSaveByShortcut.mockResolvedValue({ ok: true })
    mockSaveAs.mockResolvedValue({ ok: true })
    mockOpenProject.mockResolvedValue(undefined)
  })

  it('renders all phase-1 shell sections', () => {
    const wrapper = mount(AppShell)
    expect(wrapper.find('[data-testid="menu-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="transport-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="main-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="status-bar"]').exists()).toBe(true)
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

  it('can switch to lyrics panel without imported audio', async () => {
    const wrapper = mount(AppShell)

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
    expect(wrapper.text()).toContain('从上方「歌词」菜单导入或粘贴歌词以开始打轴')
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

  it('dispatches undo from edit menu and shows the command label', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('test')

    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')

    const undo = wrapper.get('[data-testid="menu-undo"]')
    expect(undo.text()).toContain('添加歌词行')

    await undo.trigger('click')

    expect(store.project.lyrics).toHaveLength(0)
    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('已撤销')
  })

  it('dispatches redo from edit menu and shows the command label', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('test')
    store.undo()

    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')

    const redo = wrapper.get('[data-testid="menu-redo"]')
    expect(redo.text()).toContain('添加歌词行')

    await redo.trigger('click')

    expect(store.project.lyrics).toHaveLength(1)
    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('已重做')
  })

  it('shows a status message when Ctrl+Z has nothing to undo', async () => {
    const wrapper = mount(AppShell)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    )

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
        '没有可撤销的操作',
      )
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

  it('renders the main view resize handle without consuming layout height', () => {
    const wrapper = mount(AppShell)
    const resizeSlot = wrapper.get('[data-testid="main-view-resize-slot"]')
    const resizeHandle = wrapper.get('[data-testid="main-view-resize-handle"]')

    expect(resizeSlot.classes()).toEqual(
      expect.arrayContaining(['relative', 'h-0', 'overflow-visible']),
    )
    expect(resizeHandle.classes()).toEqual(
      expect.arrayContaining(['absolute', '-top-0.5', 'h-1', 'w-full']),
    )
  })

  it('adds a lyric line when crypto.randomUUID is unavailable over HTTP', async () => {
    const originalRandomUUID = globalThis.crypto.randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    })
    try {
      const wrapper = mount(AppShell)
      const store = useEditorStore()

      await wrapper.get('[data-testid="menu-trigger-lyrics"]').trigger('click')
      await wrapper.get('[data-testid="menu-add-lyric-line"]').trigger('click')

      expect(store.project.lyrics).toHaveLength(1)
      expect(store.project.lyrics[0].id).toBeTruthy()
      expect(store.project.lyrics[0].words[0].id).toBeTruthy()
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: originalRandomUUID,
      })
    }
  })

  it('pastes lyrics when crypto.randomUUID is unavailable over HTTP', async () => {
    const originalRandomUUID = globalThis.crypto.randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    })
    try {
      const wrapper = mount(AppShell)
      const store = useEditorStore()

      await wrapper.get('[data-testid="menu-trigger-lyrics"]').trigger('click')
      await wrapper.get('[data-testid="menu-paste-lyrics"]').trigger('click')
      await wrapper
        .get('[data-testid="lyrics-paste-textarea"]')
        .setValue('hello world\nsecond line')
      await wrapper.get('[data-testid="paste-confirm-btn"]').trigger('click')

      expect(store.project.lyrics).toHaveLength(2)
      expect(store.project.lyrics[0].id).toBeTruthy()
      expect(store.project.lyrics[0].words.map((word) => word.text)).toEqual([
        'hello ',
        'world',
      ])
      expect(store.project.lyrics[1].words[0].id).toBeTruthy()
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: originalRandomUUID,
      })
    }
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

  it('wires project menu actions to persistence composable', async () => {
    const wrapper = mount(AppShell)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-save-project"]').trigger('click')
    expect(mockSaveByShortcut).toHaveBeenCalledOnce()

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-save-as"]').trigger('click')
    expect(mockSaveAs).toHaveBeenCalledOnce()

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-project"]').trigger('click')
    expect(mockOpenProject).toHaveBeenCalledOnce()
  })

  it('opens a project immediately when the current project is clean', async () => {
    const wrapper = mount(AppShell)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-project"]').trigger('click')

    expect(wrapper.find('[data-testid="unsaved-changes-dialog"]').exists()).toBe(false)
    expect(mockOpenProject).toHaveBeenCalledOnce()
  })

  it('asks for confirmation before opening another project when dirty', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('unsaved')

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-project"]').trigger('click')

    expect(wrapper.find('[data-testid="unsaved-changes-dialog"]').exists()).toBe(true)
    expect(mockOpenProject).not.toHaveBeenCalled()
  })

  it('saves and opens only after the dirty project saves successfully', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('unsaved')

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-project"]').trigger('click')
    await wrapper.get('[data-testid="unsaved-save-open"]').trigger('click')

    expect(mockSaveByShortcut).toHaveBeenCalledOnce()
    expect(mockOpenProject).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="unsaved-changes-dialog"]').exists()).toBe(false)
  })

  it('does not open another project when saving dirty changes fails', async () => {
    mockSaveByShortcut.mockResolvedValue({ ok: false, reason: 'failed' })
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('unsaved')

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-project"]').trigger('click')
    await wrapper.get('[data-testid="unsaved-save-open"]').trigger('click')

    expect(mockSaveByShortcut).toHaveBeenCalledOnce()
    expect(mockOpenProject).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="unsaved-changes-dialog"]').exists()).toBe(false)
  })

  it('opens another project without saving when the dirty confirmation is discarded', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('unsaved')

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-project"]').trigger('click')
    await wrapper.get('[data-testid="unsaved-discard-open"]').trigger('click')

    expect(mockSaveByShortcut).not.toHaveBeenCalled()
    expect(mockOpenProject).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="unsaved-changes-dialog"]').exists()).toBe(false)
  })

  it('cancels opening another project from the dirty confirmation', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('unsaved')

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-project"]').trigger('click')
    await wrapper.get('[data-testid="unsaved-cancel"]').trigger('click')

    expect(mockOpenProject).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="unsaved-changes-dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
      '已取消打开工程',
    )
  })

  it('updates project title from menu title editor', async () => {
    const wrapper = mount(AppShell, { attachTo: document.body })
    const store = useEditorStore()

    await wrapper.get('[data-testid="menu-title-button"]').trigger('click')
    await wrapper.get('[data-testid="menu-title-input"]').setValue('Renamed')
    await wrapper.get('[data-testid="menu-title-input"]').trigger('keydown.enter')

    expect(store.project.title).toBe('Renamed')
    expect(wrapper.get('[data-testid="menu-title-button"]').text()).toBe(
      '*Renamed - Lyrics Maker',
    )
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
