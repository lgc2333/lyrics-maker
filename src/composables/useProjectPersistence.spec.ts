import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { createEmptyProject } from '../core/domain/project'
import { useEditorStore } from '../stores/editor-store'
import { useProjectPersistence } from './useProjectPersistence'

const { mockOpenProject, mockSave, mockSaveAs, mockHasCachedHandle } = vi.hoisted(
  () => ({
    mockOpenProject: vi.fn(),
    mockSave: vi.fn<() => Promise<{ ok: boolean; reason?: string }>>(),
    mockSaveAs: vi.fn<() => Promise<{ ok: boolean; reason?: string }>>(),
    mockHasCachedHandle: vi.fn(() => false),
  }),
)

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
    mockLoadDraft.mockReset()
    mockSaveDraft.mockReset()
    mockClearDraft.mockReset()
    mockOpenProject.mockResolvedValue({ ok: false, reason: 'cancelled' })
    mockSave.mockResolvedValue({ ok: true })
    mockSaveAs.mockResolvedValue({ ok: true })
    mockHasCachedHandle.mockReturnValue(false)
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
})
