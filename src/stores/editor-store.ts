import { computed, shallowRef, triggerRef } from 'vue'
import { defineStore } from 'pinia'
import { createEmptyProject  } from '../core/domain/project'
import type {ProjectDocument} from '../core/domain/project';
import { createCommandHistory } from '../core/commands/history'
import { createAddLyricLineCommand } from '../core/commands/project-commands'
import type { SaveResult } from '../platform/persistence/project-file-service'

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export interface ProjectFileService {
  saveAs: (content: string) => Promise<SaveResult>
}

export const useEditorStore = defineStore('editor', () => {
  const history = shallowRef(createCommandHistory<ProjectDocument>(createEmptyProject()))
  const dirty = shallowRef(false)
  const lastError = shallowRef<string | null>(null)

  const project = computed(() => history.value.state)
  const canUndo = computed(() => history.value.canUndo)
  const canRedo = computed(() => history.value.canRedo)

  function execute(command: Parameters<typeof history.value.execute>[0]) {
    history.value.execute(command)
    dirty.value = true
    triggerRef(history)
  }

  function addLyricLine(text: string) {
    execute(createAddLyricLineCommand({ id: makeId('line'), text }))
  }

  function undo() {
    history.value.undo()
    dirty.value = true
    triggerRef(history)
  }

  function redo() {
    history.value.redo()
    dirty.value = true
    triggerRef(history)
  }

  /**
   * Set dirty flag to false. Should only be called after a confirmed save.
   */
  function markClean() {
    dirty.value = false
  }

  async function saveProject(service: ProjectFileService) {
    const json = JSON.stringify(project.value, null, 2)
    const result = await service.saveAs(json)

    if (result.ok) {
      markClean()
      lastError.value = null
    }
    else if (result.reason !== 'cancelled') {
      lastError.value = result.reason ?? 'unknown'
    }

    return result
  }

  return { project, dirty, canUndo, canRedo, lastError, addLyricLine, undo, redo, markClean, saveProject }
})
