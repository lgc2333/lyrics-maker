import type { SaveFilePickerApi } from './file-system-access'
import { hasSaveFilePicker } from './file-system-access'

export interface SaveResult {
  ok: boolean
  reason?: 'unsupported' | 'failed' | 'cancelled'
  errorMessage?: string
}

export function createProjectFileService(api: SaveFilePickerApi) {
  async function saveAs(content: string): Promise<SaveResult> {
    if (!hasSaveFilePicker(api))
      return { ok: false, reason: 'unsupported' }

    try {
      const handle = await api.showSaveFilePicker({
        suggestedName: 'lyrics-project.json',
        types: [{ description: 'Lyrics Project', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return { ok: true }
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, reason: 'cancelled' }
      }
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
  }

  return { saveAs }
}
