import type { ProjectDocument } from '../../core/domain/project'
import { parseProjectDocument } from '../../core/domain/project'
import { getLyricsExportTarget } from '../../core/lyrics-io/export-targets'
import { detectLyricsFileKind } from '../../core/lyrics-io/registry'
import type {
  LyricsDisplayFormatId,
  LyricsExportTargetId,
  LyricsFormatId,
} from '../../core/lyrics-io/types'
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

export interface OpenLyricsResult {
  ok: boolean
  reason?: 'unsupported' | 'failed' | 'cancelled' | 'invalid'
  content?: string
  fileName?: string
  format?: LyricsFormatId
  displayFormat?: LyricsDisplayFormatId
  errorMessage?: string
}

export type ReadAnyFileResult =
  | {
      ok: true
      kind: 'project'
      content: string
      fileName: string
      project: ProjectDocument
    }
  | {
      ok: true
      kind: 'lyrics'
      content: string
      fileName: string
      format: LyricsFormatId
      displayFormat: LyricsDisplayFormatId
    }
  | {
      ok: false
      kind?: 'unsupported'
      reason: 'failed' | 'invalid' | 'unsupported'
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

function lyricPickerOptions(suggestedName?: string) {
  return {
    suggestedName,
    types: [
      {
        description: 'Lyrics',
        accept: {
          'text/plain': ['.txt', '.lrc', '.srt', '.vtt', '.ass'],
          'application/xml': ['.ttml'],
        },
      },
    ],
  }
}

function lyricFileName(title: string | undefined, extension: string): string {
  const trimmed = title?.trim() || 'lyrics'
  return trimmed.toLowerCase().endsWith(`.${extension}`)
    ? trimmed
    : `${trimmed}.${extension}`
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

  async function readAnyFile(file: File): Promise<ReadAnyFileResult> {
    try {
      const content = await file.text()
      const detected = detectLyricsFileKind(file.name, content)
      if (detected.kind === 'project') {
        const parsed = JSON.parse(content) as unknown
        const project = parseProjectDocument(parsed)
        if (!project) return { ok: false, reason: 'invalid' }
        return {
          ok: true,
          kind: 'project',
          content: JSON.stringify(project),
          fileName: file.name,
          project,
        }
      }
      if (detected.kind === 'lyrics') {
        return {
          ok: true,
          kind: 'lyrics',
          content,
          fileName: file.name,
          format: detected.format,
          displayFormat: detected.displayFormat,
        }
      }
      return { ok: false, kind: 'unsupported', reason: 'unsupported' }
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof SyntaxError ? 'invalid' : 'failed',
        errorMessage: error instanceof Error ? error.message : zhCN.errors.unknownError,
      }
    }
  }

  async function openLyricsFile(): Promise<OpenLyricsResult> {
    if (!hasOpenFilePicker(api)) return { ok: false, reason: 'unsupported' }

    let handles: OpenFileHandleLike[]
    try {
      handles = await api.showOpenFilePicker({
        ...lyricPickerOptions(),
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
    const file = await handle.getFile()
    const result = await readAnyFile(file)
    if (result.ok && result.kind === 'lyrics') {
      return {
        ok: true,
        content: result.content,
        fileName: result.fileName,
        format: result.format,
        displayFormat: result.displayFormat,
      }
    }
    return { ok: false, reason: result.ok ? 'invalid' : result.reason }
  }

  async function saveLyrics(
    content: string,
    options:
      | { format: LyricsFormatId; projectTitle?: string }
      | { target: LyricsExportTargetId; projectTitle?: string },
  ): Promise<SaveResult> {
    if (!hasSaveFilePicker(api)) return { ok: false, reason: 'unsupported' }
    const extension =
      'target' in options
        ? getLyricsExportTarget(options.target).extension
        : options.format
    let handle: SaveFileHandleLike
    try {
      handle = await api.showSaveFilePicker({
        ...lyricPickerOptions(lyricFileName(options.projectTitle, extension)),
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
    return writeToHandle(handle, content)
  }

  async function save(content: string): Promise<SaveResult> {
    if (!cachedHandle) return { ok: false, reason: 'no_cached_handle' }
    return writeToHandle(cachedHandle, content)
  }

  function hasCachedHandle(): boolean {
    return cachedHandle !== null
  }

  return {
    openProject,
    openLyricsFile,
    readAnyFile,
    saveLyrics,
    saveAs,
    save,
    hasCachedHandle,
  }
}
