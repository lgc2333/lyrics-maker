import { onBeforeUnmount, onMounted, watch } from 'vue'

import { getLyricsExportTarget } from '../core/lyrics-io/export-targets'
import { getLyricsAdapter } from '../core/lyrics-io/registry'
import type {
  LyricsDisplayFormatId,
  LyricsExportTargetId,
  LyricsFormatId,
} from '../core/lyrics-io/types'
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

  function logLyricsFailure(reason: string, errorMessage?: string): void {
    console.warn('[lyrics] File workflow failed:', errorMessage ?? reason)
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

    pickLyricsImport: async () => {
      const result = await service.openLyricsFile()
      if (result.ok && result.content && result.fileName && result.format) {
        return {
          content: result.content,
          fileName: result.fileName,
          format: result.format,
          displayFormat: result.displayFormat,
        }
      }
      if (result.reason === 'cancelled') {
        store.showStatus('status.lyrics.importCancelled')
      } else if (result.reason === 'unsupported') {
        store.showStatus('status.lyrics.unsupportedFormat')
      } else {
        logLyricsFailure(result.reason ?? 'unknown', result.errorMessage)
        store.showStatus('status.lyrics.importFailed', {
          reason: result.reason ?? 'unknown',
        })
      }
      return null
    },

    readDroppedFile: async (file: File) => {
      return service.readAnyFile(file)
    },

    confirmLyricsImport: async (pending: {
      content: string
      fileName: string
      format: LyricsFormatId
      displayFormat?: LyricsDisplayFormatId
    }) => {
      try {
        const adapter = getLyricsAdapter(pending.format)
        const result = adapter.parse(pending.content, {
          audioDuration: store.duration || undefined,
        })
        if (result.lines.length === 0) {
          store.showStatus('status.lyrics.importFailed', { reason: 'invalid' })
          return false
        }
        store.replaceLyricsFromImport(result.lines, {
          format: pending.format,
          fileName: pending.fileName,
        })
        return true
      } catch (error) {
        logLyricsFailure('invalid', error instanceof Error ? error.message : undefined)
        store.showStatus('status.lyrics.importFailed', { reason: 'invalid' })
        return false
      }
    },

    exportLyrics: async (targetId: LyricsExportTargetId) => {
      try {
        const target = getLyricsExportTarget(targetId)
        const adapter = getLyricsAdapter(target.format)
        const content = adapter.export({ project: store.project }, target.options)
        if (target.format !== 'txt' && content.trim().length === 0) {
          store.showStatus('status.lyrics.exportFailed', { reason: 'invalid' })
          return { ok: false as const, reason: 'failed' as const }
        }
        const result = await service.saveLyrics(content, {
          target: target.id,
          projectTitle: store.project.title,
        })
        if (result.ok) {
          store.showStatus('status.lyrics.exportSuccess', { format: target.id })
        } else if (result.reason === 'cancelled') {
          store.showStatus('status.lyrics.exportCancelled')
        } else {
          logLyricsFailure(result.reason ?? 'unknown', result.errorMessage)
          store.showStatus('status.lyrics.exportFailed', {
            reason: result.reason ?? 'unknown',
          })
        }
        return result
      } catch (error) {
        logLyricsFailure('failed', error instanceof Error ? error.message : undefined)
        store.showStatus('status.lyrics.exportFailed', { reason: 'failed' })
        return { ok: false as const, reason: 'failed' as const }
      }
    },
  }
}
