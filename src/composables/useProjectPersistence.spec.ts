import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { createEmptyProject } from '../core/domain/project'
import { useEditorStore } from '../stores/editor-store'
import { useProjectPersistence } from './useProjectPersistence'

const {
  mockOpenProject,
  mockSave,
  mockSaveAs,
  mockHasCachedHandle,
  mockOpenLyricsFile,
  mockReadAnyFile,
  mockSaveLyrics,
} = vi.hoisted(() => ({
  mockOpenProject: vi.fn(),
  mockSave: vi.fn<() => Promise<{ ok: boolean; reason?: string }>>(),
  mockSaveAs: vi.fn<() => Promise<{ ok: boolean; reason?: string }>>(),
  mockHasCachedHandle: vi.fn(() => false),
  mockOpenLyricsFile: vi.fn(),
  mockReadAnyFile: vi.fn(),
  mockSaveLyrics: vi.fn(),
}))

const { mockLoadDraft, mockSaveDraft, mockClearDraft } = vi.hoisted(() => ({
  mockLoadDraft: vi.fn(),
  mockSaveDraft: vi.fn(),
  mockClearDraft: vi.fn(),
}))

vi.mock('../platform/persistence/file-system-access', () => ({
  getPlatformFilePickerApi: vi.fn(() => ({ showSaveFilePicker: vi.fn() })),
  getPlatformSavePickerApi: vi.fn(() => ({ showSaveFilePicker: vi.fn() })),
  hasSaveFilePicker: vi.fn(() => true),
}))

vi.mock('../platform/persistence/project-file-service', () => ({
  createProjectFileService: vi.fn(() => ({
    openProject: mockOpenProject,
    save: mockSave,
    saveAs: mockSaveAs,
    openLyricsFile: mockOpenLyricsFile,
    readAnyFile: mockReadAnyFile,
    saveLyrics: mockSaveLyrics,
    hasCachedHandle: mockHasCachedHandle,
  })),
}))

vi.mock('../platform/persistence/project-draft-service', () => ({
  createProjectDraftService: vi.fn(() => ({
    loadDraft: mockLoadDraft,
    saveDraft: mockSaveDraft,
    clearDraft: mockClearDraft,
  })),
}))

function mountHarness() {
  return mount(
    defineComponent({
      setup() {
        const result = useProjectPersistence()
        return result
      },
      render() {
        return h('div')
      },
    }),
  )
}

describe('useProjectPersistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useRealTimers()
    mockOpenProject.mockReset()
    mockSave.mockReset()
    mockSaveAs.mockReset()
    mockHasCachedHandle.mockReset()
    mockOpenLyricsFile.mockReset()
    mockReadAnyFile.mockReset()
    mockSaveLyrics.mockReset()
    mockLoadDraft.mockReset()
    mockSaveDraft.mockReset()
    mockClearDraft.mockReset()
    mockOpenProject.mockResolvedValue({ ok: false, reason: 'cancelled' })
    mockSave.mockResolvedValue({ ok: true })
    mockSaveAs.mockResolvedValue({ ok: true })
    mockHasCachedHandle.mockReturnValue(false)
    mockOpenLyricsFile.mockResolvedValue({ ok: false, reason: 'cancelled' })
    mockReadAnyFile.mockResolvedValue({ ok: false, reason: 'unsupported' })
    mockSaveLyrics.mockResolvedValue({ ok: true })
    mockLoadDraft.mockReturnValue({ ok: false, reason: 'no_draft' })
    mockSaveDraft.mockReturnValue({ ok: true })
    mockClearDraft.mockReturnValue({ ok: true })
  })

  it('saveByShortcut calls store.saveProject with service', async () => {
    const wrapper = mountHarness()
    mockSave.mockResolvedValue({ ok: true })

    const result = await wrapper.vm.saveByShortcut()

    expect(mockSave).toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('saveAs calls store.saveProjectAs with service', async () => {
    const wrapper = mountHarness()

    const result = await wrapper.vm.saveAs()

    expect(mockSaveAs).toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('openProject loads opened project and marks it clean', async () => {
    const opened = { ...createEmptyProject(), title: 'Opened' }
    mockOpenProject.mockResolvedValue({
      ok: true,
      content: JSON.stringify(opened),
      fileName: 'opened.json',
    })
    const wrapper = mountHarness()

    await wrapper.vm.openProject()

    const store = useEditorStore()
    expect(store.project.title).toBe('Opened')
    expect(store.dirty).toBe(false)
    expect(store.statusMessage?.key).toBe('status.project.openSuccess')
  })

  it('openProject reports invalid opened project files', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockOpenProject.mockResolvedValue({
      ok: false,
      reason: 'invalid',
      errorMessage: 'invalid project',
    })
    const wrapper = mountHarness()

    await wrapper.vm.openProject()

    const store = useEditorStore()
    expect(store.statusMessage?.key).toBe('status.project.openFailed')
    expect(store.statusMessage?.params?.reason).toBe('invalid')
    expect(warn).toHaveBeenCalledWith(
      '[project] Failed to open project:',
      'invalid project',
    )
    warn.mockRestore()
  })

  it('openProject loads normalized project data from the file service', async () => {
    const opened = { ...createEmptyProject(), title: 'Normalized' }
    mockOpenProject.mockResolvedValue({
      ok: true,
      content: JSON.stringify({ ...opened, title: 'Raw' }),
      project: opened,
      fileName: 'opened.json',
    })
    const wrapper = mountHarness()

    await wrapper.vm.openProject()

    const store = useEditorStore()
    expect(store.project.title).toBe('Normalized')
  })

  it('restores a valid browser draft on mount and marks it dirty', async () => {
    const draft = { ...createEmptyProject(), title: 'Draft' }
    mockLoadDraft.mockReturnValue({
      ok: true,
      content: JSON.stringify(draft),
      project: draft,
    })

    mountHarness()

    const store = useEditorStore()
    expect(store.project.title).toBe('Draft')
    expect(store.dirty).toBe(true)
    expect(store.statusMessage?.key).toBe('status.project.draftRestored')
  })

  it('saves a browser draft when the project changes', async () => {
    mountHarness()
    const store = useEditorStore()

    store.addLyricLine('draft me')
    await vi.waitFor(() => expect(mockSaveDraft).toHaveBeenCalled())
  })

  it('runs file autosave every minute and cleans up interval on unmount', async () => {
    vi.useFakeTimers()
    mockHasCachedHandle.mockReturnValue(true)
    const wrapper = mountHarness()

    await vi.advanceTimersByTimeAsync(60_000)

    expect(mockSave).toHaveBeenCalledOnce()

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(mockSave).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('does not set lastError when save is cancelled', async () => {
    // First save attempt returns no_cached_handle → falls back to saveAs which is cancelled
    mockSave.mockResolvedValue({ ok: false, reason: 'no_cached_handle' })
    mockSaveAs.mockResolvedValue({ ok: false, reason: 'cancelled' })

    const wrapper = mountHarness()
    await wrapper.vm.saveByShortcut()

    const store = useEditorStore()
    expect(store.lastError).toBeNull()
  })

  it('sets lastError when save fails with non-cancelled reason', async () => {
    mockSave.mockResolvedValue({ ok: false, reason: 'no_cached_handle' })
    mockSaveAs.mockResolvedValue({ ok: false, reason: 'failed' })

    const wrapper = mountHarness()
    await wrapper.vm.saveByShortcut()

    const store = useEditorStore()
    expect(store.lastError).toBe('failed')
  })

  it('returns a pending lyrics import from the picker without modifying project data', async () => {
    mockOpenLyricsFile.mockResolvedValue({
      ok: true,
      content: '[00:01.000]hello',
      fileName: 'song.lrc',
      format: 'lrc',
      displayFormat: 'lrc-line',
    })
    const wrapper = mountHarness()
    const store = useEditorStore()

    const pending = await wrapper.vm.pickLyricsImport()

    expect(pending).toEqual({
      content: '[00:01.000]hello',
      fileName: 'song.lrc',
      format: 'lrc',
      displayFormat: 'lrc-line',
    })
    expect(store.project.lyrics).toHaveLength(0)
  })

  it('confirms a pending lyrics import by parsing and replacing lyrics', async () => {
    const wrapper = mountHarness()
    const store = useEditorStore()

    await wrapper.vm.confirmLyricsImport({
      content: '[00:01.000]hello',
      fileName: 'song.lrc',
      format: 'lrc',
    })

    expect(store.project.lyrics).toHaveLength(1)
    expect(store.project.lyrics[0].startTime).toBe(1)
    expect(store.statusMessage?.key).toBe('status.lyrics.importSuccess')
  })

  it('exports lyrics through the selected adapter and save service', async () => {
    const wrapper = mountHarness()
    const store = useEditorStore()
    store.replaceLyricsFromImport(
      [{ startTime: 1, words: [{ text: 'hello', endTime: 2 }] }],
      { format: 'lrc', fileName: 'song.lrc' },
    )

    await wrapper.vm.exportLyrics('lrc-enhanced')

    expect(mockSaveLyrics).toHaveBeenCalledWith(
      '[00:01.000]<00:01.000>hello<00:02.000>',
      {
        target: 'lrc-enhanced',
        projectTitle: 'Untitled Project',
      },
    )
    expect(store.statusMessage?.key).toBe('status.lyrics.exportSuccess')
  })

  it('exports ordinary line LRC through the selected export target', async () => {
    const wrapper = mountHarness()
    const store = useEditorStore()
    store.replaceLyricsFromImport(
      [{ startTime: 1, words: [{ text: 'hello', endTime: 2 }] }],
      { format: 'lrc', fileName: 'song.lrc' },
    )

    await wrapper.vm.exportLyrics('lrc-line')

    expect(mockSaveLyrics).toHaveBeenCalledWith('[00:01.000]hello\n[00:02.000]', {
      target: 'lrc-line',
      projectTitle: 'Untitled Project',
    })
  })

  it('exports ESLyric through the selected export target', async () => {
    const wrapper = mountHarness()
    const store = useEditorStore()
    store.replaceLyricsFromImport(
      [{ startTime: 1, words: [{ text: 'hello', endTime: 2 }] }],
      { format: 'lrc', fileName: 'song.lrc' },
    )

    await wrapper.vm.exportLyrics('lrc-eslyric')

    expect(mockSaveLyrics).toHaveBeenCalledWith(
      '[00:01.000][00:01.000]hello[00:02.000]',
      {
        target: 'lrc-eslyric',
        projectTitle: 'Untitled Project',
      },
    )
  })

  it('rejects timed-format export when lyrics have no usable timing', async () => {
    const wrapper = mountHarness()
    const store = useEditorStore()
    store.insertLyricLines([{ id: 'l1', words: [{ id: 'w1', text: 'untimed' }] }])

    await wrapper.vm.exportLyrics('lrc-enhanced')

    expect(mockSaveLyrics).not.toHaveBeenCalled()
    expect(store.statusMessage?.key).toBe('status.lyrics.exportFailed')
  })

  it('rejects parsed lyric imports that contain no lines', async () => {
    const wrapper = mountHarness()
    const store = useEditorStore()
    store.addLyricLine('keep')

    await wrapper.vm.confirmLyricsImport({
      content: '[bad',
      fileName: 'bad.lrc',
      format: 'lrc',
    })

    expect(store.project.lyrics[0].words[0].text).toBe('keep')
    expect(store.statusMessage?.key).toBe('status.lyrics.importFailed')
  })
})
