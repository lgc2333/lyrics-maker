import { lrcAdapter } from './lrc'
import { assAdapter, srtAdapter, vttAdapter } from './subtitles'
import { ttmlAdapter } from './ttml'
import { txtAdapter } from './txt'
import type {
  DetectedFileKind,
  LrcFlavor,
  LyricsDisplayFormatId,
  LyricsFormatAdapter,
  LyricsFormatId,
} from './types'

const adapters = new Map<LyricsFormatId, LyricsFormatAdapter>(
  [txtAdapter, lrcAdapter, ttmlAdapter, assAdapter, srtAdapter, vttAdapter].map(
    (adapter) => [adapter.id, adapter],
  ),
)

const extensionFormats: Record<string, LyricsFormatId> = {
  txt: 'txt',
  lrc: 'lrc',
  ttml: 'ttml',
  ass: 'ass',
  srt: 'srt',
  vtt: 'vtt',
}

export function getLyricsAdapter(format: LyricsFormatId): LyricsFormatAdapter {
  const adapter = adapters.get(format)
  if (!adapter) throw new Error(`Unsupported lyrics format: ${format}`)
  return adapter
}

function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function looksLikeProjectJson(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { version?: unknown; lyrics?: unknown }
    return parsed.version === 1 && Array.isArray(parsed.lyrics)
  } catch {
    return false
  }
}

function displayFormatFor(format: LyricsFormatId): LyricsDisplayFormatId {
  if (format === 'txt') return 'txt'
  if (format === 'ttml') return 'ttml'
  if (format === 'ass') return 'ass'
  if (format === 'srt') return 'srt'
  if (format === 'vtt') return 'vtt'
  return 'lrc-line'
}

function detectLrcFlavor(text: string): LrcFlavor {
  if (/<\d+:[0-5]\d(?:[.:]\d{1,3})?>/.test(text)) return 'enhanced'

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const match = /^\s*\[\d+:[0-5]\d(?:[.:]\d{1,3})?\](?<body>.*)$/.exec(line)
    if (!match) continue
    const body = match.groups?.body ?? ''
    if (/^\s*\[\d+:[0-5]\d(?:[.:]\d{1,3})?\]/.test(body)) continue
    if (/[^\s[]+\s*\[\d+:[0-5]\d(?:[.:]\d{1,3})?\]/.test(body)) {
      return 'eslyric'
    }
  }

  return 'line'
}

function lrcDisplayFormat(flavor: LrcFlavor): LyricsDisplayFormatId {
  if (flavor === 'enhanced') return 'lrc-enhanced'
  if (flavor === 'eslyric') return 'lrc-eslyric'
  return 'lrc-line'
}

function lyricsResult(format: LyricsFormatId, text: string): DetectedFileKind {
  if (format === 'lrc') {
    const lrcFlavor = detectLrcFlavor(text)
    return {
      kind: 'lyrics',
      format,
      displayFormat: lrcDisplayFormat(lrcFlavor),
      lrcFlavor,
    }
  }
  return { kind: 'lyrics', format, displayFormat: displayFormatFor(format) }
}

function detectByContent(text: string): LyricsFormatId | null {
  const trimmed = text.trim()
  if (/^WEBVTT\b/i.test(trimmed)) return 'vtt'
  if (/\d\d:\d\d:\d\d,\d{1,3}\s+-->\s+\d\d:\d\d:\d\d,\d{1,3}/.test(text)) {
    return 'srt'
  }
  if (
    /\[Script Info\]/i.test(text) &&
    /\[Events\]/i.test(text) &&
    /^Dialogue:/im.test(text)
  ) {
    return 'ass'
  }
  if (/<tt\b/i.test(text) && /<p\b/i.test(text)) return 'ttml'
  if (/^\s*\[\d+:[0-5]\d(?:[.:]\d{1,3})?\]/m.test(text)) return 'lrc'
  return null
}

export function detectLyricsFileKind(fileName: string, text: string): DetectedFileKind {
  if (looksLikeProjectJson(text)) return { kind: 'project' }

  const contentFormat = detectByContent(text)
  if (contentFormat) return lyricsResult(contentFormat, text)

  const ext = extensionOf(fileName)
  const extFormat = extensionFormats[ext]
  if (extFormat) return lyricsResult(extFormat, text)
  return { kind: 'unsupported' }
}
