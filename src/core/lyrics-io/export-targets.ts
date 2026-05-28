import type { LyricsExportTarget, LyricsExportTargetId } from './types'

const exportTargets: Record<LyricsExportTargetId, LyricsExportTarget> = {
  txt: { id: 'txt', format: 'txt', extension: 'txt' },
  'lrc-line': {
    id: 'lrc-line',
    format: 'lrc',
    extension: 'lrc',
    options: { lrcWordTiming: 'line' },
  },
  'lrc-enhanced': {
    id: 'lrc-enhanced',
    format: 'lrc',
    extension: 'lrc',
    options: { lrcWordTiming: 'angle' },
  },
  'lrc-eslyric': {
    id: 'lrc-eslyric',
    format: 'lrc',
    extension: 'lrc',
    options: { lrcWordTiming: 'square' },
  },
  ttml: { id: 'ttml', format: 'ttml', extension: 'ttml' },
  ass: { id: 'ass', format: 'ass', extension: 'ass' },
  srt: { id: 'srt', format: 'srt', extension: 'srt' },
  vtt: { id: 'vtt', format: 'vtt', extension: 'vtt' },
}

export function getLyricsExportTarget(id: LyricsExportTargetId): LyricsExportTarget {
  return exportTargets[id]
}

export const lyricExportTargets: readonly LyricsExportTarget[] =
  Object.values(exportTargets)
