import { TTMLGenerator, TTMLParser } from '@applemusic-like-lyrics/ttml'
import type { LyricLine as AmllTtmlLine, Syllable } from '@applemusic-like-lyrics/ttml'
import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom'

import { lineEndTime, timedSegmentsToLine } from './line-builder'
import type { ImportedLyricLine, LyricsFormatAdapter } from './types'

function toSeconds(ms: number): number {
  return ms / 1000
}

function toMs(seconds: number): number {
  return Math.round(seconds * 1000)
}

function normalizeSyllableText(syllable: Syllable): string {
  return `${syllable.text}${syllable.endsWithSpace ? ' ' : ''}`
}

function importLine(line: AmllTtmlLine): ImportedLyricLine {
  const lineStart = toSeconds(line.startTime)
  const lineEnd = toSeconds(line.endTime)
  if (line.words && line.words.length > 0) {
    return timedSegmentsToLine(
      lineStart,
      lineEnd,
      line.words.map((word) => ({
        text: normalizeSyllableText(word),
        startTime: toSeconds(word.startTime),
        endTime: toSeconds(word.endTime),
      })),
    )
  }
  return {
    startTime: lineStart,
    words: [{ text: line.text, endTime: lineEnd }],
  }
}

function splitTrailingSpace(text: string): { text: string; endsWithSpace?: boolean } {
  if (!/\s$/.test(text)) return { text }
  return { text: text.trimEnd(), endsWithSpace: true }
}

function exportLine(line: {
  id: string
  startTime?: number
  words: readonly { id: string; text: string; endTime?: number }[]
}): AmllTtmlLine | null {
  if (line.startTime === undefined) return null
  const endTime = lineEndTime(line)
  if (endTime === null) return null

  let boundary = line.startTime
  const words: Syllable[] = []
  for (const word of line.words) {
    if (word.endTime === undefined) return null
    const text = splitTrailingSpace(word.text)
    words.push({
      text: text.text,
      startTime: toMs(boundary),
      endTime: toMs(word.endTime),
      endsWithSpace: text.endsWithSpace,
    })
    boundary = word.endTime
  }

  return {
    id: line.id,
    text: line.words.map((word) => word.text).join(''),
    startTime: toMs(line.startTime),
    endTime: toMs(endTime),
    words,
  }
}

export const ttmlAdapter: LyricsFormatAdapter = {
  id: 'ttml',
  label: 'TTML',
  extension: 'ttml',
  parse(text) {
    const result = TTMLParser.parse(text, {
      domParser: new DOMParser(),
    })
    return {
      lines: result.lines.map(importLine),
    }
  },
  export(input) {
    const lines = input.project.lyrics
      .map(exportLine)
      .filter((line): line is AmllTtmlLine => line !== null)

    return TTMLGenerator.generate(
      {
        metadata: {
          title: [input.project.title],
          timingMode: 'Word',
        },
        lines,
      },
      {
        domImplementation: new DOMImplementation(),
        xmlSerializer: new XMLSerializer(),
      },
    )
  },
}
