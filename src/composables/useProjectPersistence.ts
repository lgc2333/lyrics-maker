import { onBeforeUnmount, onMounted, watch } from 'vue'

import {
  getPlatformFilePickerApi,
  getPlatformSavePickerApi,
  hasSaveFilePicker,
} from '../platform/persistence/file-system-access'
import { createProjectDraftService } from '../platform/persistence/project-draft-service'
import { createProjectFileService } from '../platform/persistence/project-file-service'
import { useEditorStore } from '../stores/editor-store'

export function useProjectPersistence() {
  const store = useEditorStore()
  const api = getPlatformFilePickerApi()
  const saveApi = getPlatformSavePickerApi()
  const service = createProjectFileService(api)
  const draftService = createProjectDraftService()
  let autoSaveTimer: number | null = null
  let skipNextDraftWrite = false

  function saveDraft(): void {
    draftService.saveDraft(JSON.stringify(store.project, null, 2))
  }

  function logProjectOpenFailure(reason: string, errorMessage?: string): void {
    console.warn('[project] Failed to open project:', errorMessage ?? reason)
  }

  onMounted(() => {
    const draft = draftService.loadDraft()
    if (draft.ok && draft.project) {
      skipNextDraftWrite = true
      store.loadProject(draft.project, { dirty: true })
    }

    autoSaveTimer = window.setInterval(() => {
      void store.autoSaveProject(service)
    }, 60_000)
  })

  onBeforeUnmount(() => {
    if (autoSaveTimer !== null) {
      window.clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
  })

  watch(
    () => store.project,
    () => {
      if (skipNextDraftWrite) {
        skipNextDraftWrite = false
        return
      }
      saveDraft()
    },
    { deep: true },
  )

  return {
    hasFileApi: () => hasSaveFilePicker(saveApi),

    saveByShortcut: async () => {
      return store.saveProject(service)
    },

    saveAs: async () => {
      return store.saveProjectAs(service)
    },

    openProject: async () => {
      const result = await service.openProject()
      if (result.ok && result.project) {
        store.loadProject(result.project, { dirty: false })
      } else if (result.ok && result.content) {
        try {
          store.loadProject(JSON.parse(result.content), { dirty: false })
        } catch (error) {
          logProjectOpenFailure(
            'invalid',
            error instanceof Error ? error.message : undefined,
          )
          store.showStatus('status.project.openFailed', { reason: 'invalid' })
        }
      } else if (result.reason === 'unsupported') {
        store.showStatus('status.project.unsupportedFileApi')
      } else if (result.reason === 'failed') {
        logProjectOpenFailure(result.reason, result.errorMessage)
        store.showStatus('status.project.openFailed', {
          reason: result.reason,
        })
      } else if (result.reason === 'invalid') {
        logProjectOpenFailure(result.reason, result.errorMessage)
        store.showStatus('status.project.openFailed', { reason: result.reason })
      } else if (result.reason === 'cancelled') {
        store.showStatus('status.project.openCancelled')
      }
    },
  }
}
