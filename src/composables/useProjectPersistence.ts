import { hasSaveFilePicker } from '../platform/persistence/file-system-access'
import { createProjectFileService } from '../platform/persistence/project-file-service'
import { useEditorStore } from '../stores/editor-store'

export function useProjectPersistence() {
  const store = useEditorStore()
  const api =
    window as unknown as import('../platform/persistence/file-system-access').SaveFilePickerApi
  const service = createProjectFileService(api)

  return {
    hasFileApi: () => hasSaveFilePicker(api),

    saveByShortcut: async () => {
      await store.saveProject(service)
    },
  }
}
