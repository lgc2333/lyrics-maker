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

const {
  mockSaveByShortcut,
  mockSaveAs,
  mockOpenProject,
  mockPickLyricsImport,
  mockConfirmLyricsImport,
  mockExportLyrics,
  mockReadAnyFile,
} = vi.hoisted(() => ({
  mockSaveByShortcut: vi.fn(),
  mockSaveAs: vi.fn(),
  mockOpenProject: vi.fn(),
  mockPickLyricsImport: vi.fn(),
  mockConfirmLyricsImport: vi.fn(),
  mockExportLyrics: vi.fn(),
  mockReadAnyFile: vi.fn(),
}))

vi.mock('../../composables/useProjectPersistence', () => ({
  useProjectPersistence: vi.fn(() => ({
    hasFileApi: () => true,
    saveByShortcut: mockSaveByShortcut,
    saveAs: mockSaveAs,
    openProject: mockOpenProject,
    pickLyricsImport: mockPickLyricsImport,
    confirmLyricsImport: mockConfirmLyricsImport,
    exportLyrics: mockExportLyrics,
    readDroppedFile: mockReadAnyFile,
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
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    mockSaveByShortcut.mockReset()
    mockSaveAs.mockReset()
    mockOpenProject.mockReset()
    mockPickLyricsImport.mockReset()
    mockConfirmLyricsImport.mockReset()
    mockExportLyrics.mockReset()
    mockReadAnyFile.mockReset()
    mockSaveByShortcut.mockResolvedValue({ ok: true })
    mockSaveAs.mockResolvedValue({ ok: true })
    mockOpenProject.mockResolvedValue(undefined)
    mockPickLyricsImport.mockResolvedValue(null)
    mockConfirmLyricsImport.mockResolvedValue(true)
    mockExportLyrics.mockResolvedValue({ ok: true })
    mockReadAnyFile.mockResolvedValue({ ok: false, reason: 'unsupported' })
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

  it('deletes the selected lyric line with Delete while lyrics panel is active', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'line-1', words: [{ id: 'w1', text: 'first' }] },
      { id: 'line-2', words: [{ id: 'w2', text: 'second' }] },
    ])

    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    await wrapper.get('[data-testid="lyrics-line-row"]').trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))

    await vi.waitFor(() => {
      expect(store.project.lyrics.map((line) => line.id)).toEqual(['line-2'])
    })
  })

  it('deletes the selected timing point with Delete while timing panel is active', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.insertLyricLines([{ id: 'line-1', words: [{ id: 'w1', text: 'first' }] }])
    const defaultPointId = store.project.timingPoints[0].id

    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    await wrapper.get('[data-testid="lyrics-line-row"]').trigger('click')
    await wrapper.get('[data-testid="mode-switch-timing"]').trigger('click')
    await wrapper.get('[data-testid="timing-point-row"]').trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))

    await vi.waitFor(() => {
      expect(
        store.project.timingPoints.some((point) => point.id === defaultPointId),
      ).toBe(false)
    })
    expect(store.project.lyrics.map((line) => line.id)).toEqual(['line-1'])
  })

  it('clears the selected lyric line with Escape while lyrics panel is active', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.insertLyricLines([{ id: 'line-1', words: [{ id: 'w1', text: 'first' }] }])

    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    await wrapper.get('[data-testid="lyrics-line-row"]').trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    await vi.waitFor(() => {
      expect(
        wrapper.get('[data-testid="lyrics-line-row"]').attributes('aria-selected'),
      ).toBe('false')
    })
  })

  it('clears the selected timing point with Escape while timing panel is active', async () => {
    const wrapper = mount(AppShell)

    await wrapper.get('[data-testid="timing-point-row"]').trigger('click')
    expect(
      wrapper.get('[data-testid="timing-point-row"]').attributes('aria-selected'),
    ).toBe('true')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    await vi.waitFor(() => {
      expect(
        wrapper.get('[data-testid="timing-point-row"]').attributes('aria-selected'),
      ).toBe('false')
    })
  })

  it('opens whole-line edit with Tab in lyrics mode', async () => {
    const wrapper = mount(AppShell, { attachTo: document.body })
    const store = useEditorStore()
    store.insertLyricLines([{ id: 'line-1', words: [{ id: 'w1', text: 'first' }] }])

    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    await wrapper.get('[data-testid="lyrics-line-row"]').trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="whole-line-input"]').exists()).toBe(true)
    })

    expect(document.activeElement).toBe(
      wrapper.get('[data-testid="whole-line-input"]').element,
    )

    wrapper.unmount()
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

  it('theme menu updates html data-theme attribute and local settings', async () => {
    const wrapper = mount(AppShell)
    await wrapper.get('[data-testid="theme-toggle"]').trigger('click')
    await wrapper.get('[data-testid="theme-option-dark"]').trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('lyrics-maker.local-settings.v1')).toContain(
      '"theme": "dark"',
    )
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
      mount(AppShell)
      const store = useEditorStore()

      store.addLyricLine('')

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

      ;(wrapper.vm as unknown as { showPasteModal: boolean }).showPasteModal = true
      await wrapper.vm.$nextTick()
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

  it('opens import confirmation before replacing lyrics from a selected file', async () => {
    mockPickLyricsImport.mockResolvedValue({
      content: '[00:01.000]hello',
      fileName: 'song.lrc',
      format: 'lrc',
      displayFormat: 'lrc-line',
    })
    const wrapper = mount(AppShell)
    const store = useEditorStore()

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-import-lyrics"]').trigger('click')

    expect(wrapper.find('[data-testid="import-confirm-modal"]').exists()).toBe(true)
    expect(mockConfirmLyricsImport).not.toHaveBeenCalled()
    expect(store.project.lyrics).toHaveLength(0)

    await wrapper.get('[data-testid="import-confirm"]').trigger('click')
    expect(mockConfirmLyricsImport).toHaveBeenCalledWith({
      content: '[00:01.000]hello',
      fileName: 'song.lrc',
      format: 'lrc',
      displayFormat: 'lrc-line',
    })
  })

  it('cancels a pending lyrics import without confirming', async () => {
    mockPickLyricsImport.mockResolvedValue({
      content: 'hello',
      fileName: 'song.txt',
      format: 'txt',
      displayFormat: 'txt',
    })
    const wrapper = mount(AppShell)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-import-lyrics"]').trigger('click')
    await wrapper.get('[data-testid="import-cancel"]').trigger('click')

    expect(mockConfirmLyricsImport).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="import-confirm-modal"]').exists()).toBe(false)
  })

  it('exports lyrics as LRC from the file menu', async () => {
    const wrapper = mount(AppShell)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-export-lyrics"]').trigger('mouseenter')
    await wrapper
      .get('[data-testid="menu-export-lyrics-lrc-enhanced"]')
      .trigger('click')

    expect(mockExportLyrics).toHaveBeenCalledWith('lrc-enhanced')
  })

  it('opens validation warning before exporting lyrics with project issues', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.replaceLyricsFromImport(
      [
        {
          words: [{ text: 'untimed' }],
        },
      ],
      { format: 'txt', fileName: 'bad.txt' },
    )

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-export-lyrics"]').trigger('mouseenter')
    await wrapper.get('[data-testid="menu-export-lyrics-ttml"]').trigger('click')

    expect(wrapper.find('[data-testid="project-validation-modal"]').exists()).toBe(true)
    expect(mockExportLyrics).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="project-validation-continue"]').trigger('click')

    expect(mockExportLyrics).toHaveBeenCalledWith('ttml')
    expect(wrapper.find('[data-testid="project-validation-modal"]').exists()).toBe(
      false,
    )
  })

  it('cancels export from validation warning', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.replaceLyricsFromImport(
      [
        {
          words: [{ text: 'untimed' }],
        },
      ],
      { format: 'txt', fileName: 'bad.txt' },
    )

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-export-lyrics"]').trigger('mouseenter')
    await wrapper.get('[data-testid="menu-export-lyrics-ttml"]').trigger('click')
    await wrapper.get('[data-testid="project-validation-cancel"]').trigger('click')

    expect(mockExportLyrics).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="project-validation-modal"]').exists()).toBe(
      false,
    )
    expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
      '已取消导出歌词',
    )
  })

  it('validates the project from the file menu without exporting', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.replaceLyricsFromImport(
      [
        {
          words: [{ text: 'untimed' }],
        },
      ],
      { format: 'txt', fileName: 'bad.txt' },
    )

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-validate-project"]').trigger('click')

    expect(wrapper.find('[data-testid="project-validation-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="project-validation-close"]').exists()).toBe(true)
    expect(mockExportLyrics).not.toHaveBeenCalled()
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

  it('creates a clean new project immediately when current project is clean', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('will be reset')
    store.markClean()

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')

    expect(store.project.lyrics).toHaveLength(0)
    expect(store.dirty).toBe(false)
  })

  it('asks for confirmation before creating a new project when dirty', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('unsaved')

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')

    expect(wrapper.find('[data-testid="unsaved-changes-dialog"]').exists()).toBe(true)
    await wrapper.get('[data-testid="unsaved-discard-open"]').trigger('click')
    expect(store.project.lyrics).toHaveLength(0)
  })

  it('rejects multiple dropped files with a status message', async () => {
    const wrapper = mount(AppShell)
    const store = useEditorStore()

    await wrapper.trigger('drop', {
      dataTransfer: {
        files: [new File(['a'], 'a.lrc'), new File(['b'], 'b.lrc')],
      },
    })

    expect(store.statusMessage?.key).toBe('status.lyrics.dropMultipleUnsupported')
  })

  it('opens import confirmation for a dropped lyrics file', async () => {
    mockReadAnyFile.mockResolvedValue({
      ok: true,
      kind: 'lyrics',
      content: 'hello',
      fileName: 'song.txt',
      format: 'txt',
      displayFormat: 'txt',
    })
    const wrapper = mount(AppShell)

    await wrapper.trigger('drop', {
      dataTransfer: {
        files: [new File(['hello'], 'song.txt')],
      },
    })

    expect(mockReadAnyFile).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="import-confirm-modal"]').exists()).toBe(true)
  })

  it('loads a dropped project after dirty confirmation without opening the picker', async () => {
    const droppedProject = { ...useEditorStore().project, title: 'Dropped' }
    mockReadAnyFile.mockResolvedValue({
      ok: true,
      kind: 'project',
      content: JSON.stringify(droppedProject),
      fileName: 'dropped.json',
      project: droppedProject,
    })
    const wrapper = mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('unsaved')

    await wrapper.trigger('drop', {
      dataTransfer: {
        files: [new File([JSON.stringify(droppedProject)], 'dropped.json')],
      },
    })

    expect(wrapper.find('[data-testid="unsaved-changes-dialog"]').exists()).toBe(true)
    await wrapper.get('[data-testid="unsaved-discard-open"]').trigger('click')

    expect(mockOpenProject).not.toHaveBeenCalled()
    expect(store.project.title).toBe('Dropped')
    expect(store.dirty).toBe(false)
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

  it('defaults theme from local settings instead of system preference', async () => {
    const wrapper = mount(AppShell)
    await wrapper.vm.$nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('follows system theme when local setting is system', async () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    let systemPrefersDark = true
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          matches: systemPrefersDark,
          media: '(prefers-color-scheme: dark)',
          onchange: null,
          addEventListener: vi.fn((_event, listener) => {
            listeners.add(listener as (event: MediaQueryListEvent) => void)
          }),
          removeEventListener: vi.fn((_event, listener) => {
            listeners.delete(listener as (event: MediaQueryListEvent) => void)
          }),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    )
    localStorage.setItem(
      'lyrics-maker.local-settings.v1',
      JSON.stringify({ version: 1, theme: 'system' }),
    )

    try {
      const wrapper = mount(AppShell)
      await wrapper.vm.$nextTick()
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      systemPrefersDark = false
      listeners.forEach((listener) =>
        listener({ matches: false } as MediaQueryListEvent),
      )
      await wrapper.vm.$nextTick()

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    } finally {
      matchMediaSpy.mockRestore()
    }
  })

  it('opens preferences and restores settings from a selected json file', async () => {
    const wrapper = mount(AppShell)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-preferences"]').trigger('click')
    await wrapper.get('[data-testid="preferences-tab-backup"]').trigger('click')

    const restoreInput = wrapper.get('[data-testid="settings-restore-input"]')
      .element as HTMLInputElement
    Object.defineProperty(restoreInput, 'files', {
      configurable: true,
      value: [
        new File([JSON.stringify({ version: 1, theme: 'dark' })], 'settings.json', {
          type: 'application/json',
        }),
      ],
    })

    await wrapper.get('[data-testid="preferences-restore"]').trigger('click')
    await restoreInput.dispatchEvent(new Event('change'))

    await vi.waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
    expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
      '本地设置导入成功',
    )
  })
})
