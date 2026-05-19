import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useEditorStore } from '../stores/editor-store'
import { useProjectPersistence } from './useProjectPersistence'

const { mockSave, mockSaveAs } = vi.hoisted(() => ({
  mockSave: vi.fn<() => Promise<{ ok: boolean; reason?: string }>>(),
  mockSaveAs: vi.fn<() => Promise<{ ok: boolean; reason?: string }>>(),
}))

vi.mock('../platform/persistence/file-system-access', () => ({
  getPlatformSavePickerApi: vi.fn(() => ({ showSaveFilePicker: vi.fn() })),
  hasSaveFilePicker: vi.fn(() => true),
}))

vi.mock('../platform/persistence/project-file-service', () => ({
  createProjectFileService: vi.fn(() => ({
    save: mockSave,
    saveAs: mockSaveAs,
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
    mockSave.mockReset()
    mockSaveAs.mockReset()
    mockSave.mockResolvedValue({ ok: true })
    mockSaveAs.mockResolvedValue({ ok: true })
  })

  it('saveByShortcut calls store.saveProject with service', async () => {
    const wrapper = mountHarness()
    mockSave.mockResolvedValue({ ok: true })

    await wrapper.vm.saveByShortcut()

    expect(mockSave).toHaveBeenCalled()
  })

  it('does not set lastError when save is cancelled', async () => {
    // First save attempt returns unsupported → falls back to saveAs which is cancelled
    mockSave.mockResolvedValue({ ok: false, reason: 'unsupported' })
    mockSaveAs.mockResolvedValue({ ok: false, reason: 'cancelled' })

    const wrapper = mountHarness()
    await wrapper.vm.saveByShortcut()

    const store = useEditorStore()
    expect(store.lastError).toBeNull()
  })

  it('sets lastError when save fails with non-cancelled reason', async () => {
    mockSave.mockResolvedValue({ ok: false, reason: 'unsupported' })
    mockSaveAs.mockResolvedValue({ ok: false, reason: 'failed' })

    const wrapper = mountHarness()
    await wrapper.vm.saveByShortcut()

    const store = useEditorStore()
    expect(store.lastError).toBe('failed')
  })
})
