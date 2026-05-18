import zhCN from '../i18n/locales/zh-CN.json'
import type { SaveFileHandleLike, SaveFilePickerApi } from './file-system-access'
import { hasSaveFilePicker } from './file-system-access'

export interface SaveResult {
  ok: boolean
  reason?: 'unsupported' | 'failed' | 'cancelled'
  errorMessage?: string
}

export function createProjectFileService(api: SaveFilePickerApi) {
  let cachedHandle: SaveFileHandleLike | null = null

  async function writeToHandle(
    handle: SaveFileHandleLike,
    content: string,
  ): Promise<SaveResult> {
    try {
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return { ok: true }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, reason: 'cancelled' }
      }
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : zhCN.errors.unknownError,
      }
    }
  }

  async function saveAs(content: string): Promise<SaveResult> {
    if (!hasSaveFilePicker(api)) return { ok: false, reason: 'unsupported' }

    let handle: SaveFileHandleLike
    try {
      handle = await api.showSaveFilePicker({
        suggestedName: zhCN.project.suggestedFileName,
        types: [
          {
            description: zhCN.project.fileTypeDescription,
            accept: { 'application/json': ['.json'] },
          },
        ],
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, reason: 'cancelled' }
      }
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : zhCN.errors.unknownError,
      }
    }

    cachedHandle = handle
    return writeToHandle(handle, content)
  }

  async function save(content: string): Promise<SaveResult> {
    if (!cachedHandle) return { ok: false, reason: 'unsupported' }
    return writeToHandle(cachedHandle, content)
  }

  return { saveAs, save }
}
