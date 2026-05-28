import type { ProjectDocument } from '../domain/project'

export type LyricsFormatId = 'txt' | 'lrc' | 'ttml' | 'ass' | 'srt' | 'vtt'
export type LrcFlavor = 'line' | 'enhanced' | 'eslyric'
export type LyricsDisplayFormatId =
  | 'txt'
  | 'lrc-line'
  | 'lrc-enhanced'
  | 'lrc-eslyric'
  | 'ttml'
  | 'ass'
  | 'srt'
  | 'vtt'
export type LyricsExportTargetId =
  | 'txt'
  | 'lrc-line'
  | 'lrc-enhanced'
  | 'lrc-eslyric'
  | 'ttml'
  | 'ass'
  | 'srt'
  | 'vtt'

export interface ImportedLyricWord {
  text: string
  endTime?: number
}

export interface ImportedLyricLine {
  words: ImportedLyricWord[]
  startTime?: number
}

export interface LyricsImportResult {
  lines: ImportedLyricLine[]
}

export interface LyricsParseOptions {
  audioDuration?: number
}

export interface LyricsExportInput {
  project: ProjectDocument
}

export interface LyricsExportOptions {
  lrcWordTiming?: 'angle' | 'square' | 'line'
}

export interface LyricsFormatAdapter {
  id: LyricsFormatId
  label: string
  extension: string
  parse: (text: string, options?: LyricsParseOptions) => LyricsImportResult
  export: (input: LyricsExportInput, options?: LyricsExportOptions) => string
}

export type DetectedFileKind =
  | { kind: 'project' }
  | {
      kind: 'lyrics'
      format: LyricsFormatId
      displayFormat: LyricsDisplayFormatId
      lrcFlavor?: LrcFlavor
    }
  | { kind: 'unsupported' }

export interface LyricsExportTarget {
  id: LyricsExportTargetId
  format: LyricsFormatId
  extension: string
  options?: LyricsExportOptions
}
