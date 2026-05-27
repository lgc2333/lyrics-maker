import type { ProjectDocument } from '../../core/domain/project'
import { parseProjectDocument } from '../../core/domain/project'
import zhCN from '../../i18n/locales/zh-CN.json'
import type {
  OpenFileHandleLike,
  ProjectFilePickerApi,
  SaveFileHandleLike,
} from './file-system-access'
import { hasOpenFilePicker, hasSaveFilePicker } from './file-system-access'

export interface SaveResult {
  ok: boolean
  reason?: 'unsupported' | 'failed' | 'cancelled' | 'no_cached_handle'
  errorMessage?: string
}

export interface OpenProjectResult {
  ok: boolean
  reason?: 'unsupported' | 'failed' | 'cancelled' | 'invalid'
  content?: string
  fileName?: string
  project?: ProjectDocument
  errorMessage?: string
}

function projectPickerOptions(suggestedName?: string) {
  return {
    suggestedName,
    types: [
      {
        description: zhCN.project.fileTypeDescription,
        accept: { 'application/json': ['.json'] },
      },
    ],
  }
}

function projectFileName(title?: string): string {
  const trimmed = title?.trim()
  if (!trimmed) return zhCN.project.suggestedFileName
  return trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`
}

export function createProjectFileService(api: ProjectFilePickerApi) {
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

  async function saveAs(content: string, title?: string): Promise<SaveResult> {
    if (!hasSaveFilePicker(api)) return { ok: false, reason: 'unsupported' }

    let handle: SaveFileHandleLike
    try {
      handle = await api.showSaveFilePicker({
        ...projectPickerOptions(projectFileName(title)),
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

    const writeResult = await writeToHandle(handle, content)
    if (writeResult.ok) {
      cachedHandle = handle
    }
    return writeResult
  }

  async function openProject(): Promise<OpenProjectResult> {
    if (!hasOpenFilePicker(api)) return { ok: false, reason: 'unsupported' }

    let handles: OpenFileHandleLike[]
    try {
      handles = await api.showOpenFilePicker({
        ...projectPickerOptions(),
        multiple: false,
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

    const handle = handles[0]
    if (!handle) return { ok: false, reason: 'cancelled' }

    try {
      const file = await handle.getFile()
      const content = await file.text()
      const parsed = JSON.parse(content) as unknown
      const project = parseProjectDocument(parsed)
      if (!project) return { ok: false, reason: 'invalid' }
      cachedHandle = handle
      return {
        ok: true,
        content: JSON.stringify(project),
        fileName: file.name,
        project,
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          ok: false,
          reason: 'invalid',
          errorMessage: error.message,
        }
      }
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : zhCN.errors.unknownError,
      }
    }
  }

  async function save(content: string): Promise<SaveResult> {
    if (!cachedHandle) return { ok: false, reason: 'no_cached_handle' }
    return writeToHandle(cachedHandle, content)
  }

  function hasCachedHandle(): boolean {
    return cachedHandle !== null
  }

  return { openProject, saveAs, save, hasCachedHandle }
}
