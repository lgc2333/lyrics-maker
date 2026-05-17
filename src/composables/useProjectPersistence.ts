import {
  getPlatformSavePickerApi,
  hasSaveFilePicker,
} from '../platform/persistence/file-system-access'
import { createProjectFileService } from '../platform/persistence/project-file-service'
import { useEditorStore } from '../stores/editor-store'

export function useProjectPersistence() {
  const store = useEditorStore()
  const api = getPlatformSavePickerApi()
  const service = createProjectFileService(api)

  return {
    hasFileApi: () => hasSaveFilePicker(api),

    saveByShortcut: async () => {
      await store.saveProject(service)
    },
  }
}
