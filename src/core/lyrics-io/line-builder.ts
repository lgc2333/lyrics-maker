import { autoSplitText } from '../lyrics/auto-split'
import type { ImportedLyricLine, ImportedLyricWord } from './types'

export function textToUntimedWords(text: string): ImportedLyricWord[] {
  return autoSplitText(text).map((token) => ({ text: token }))
}

export function textIntervalToLine(
  text: string,
  startTime: number,
  endTime: number,
): ImportedLyricLine {
  const words = textToUntimedWords(text)
  if (words.length > 0) {
    words[words.length - 1] = { ...words[words.length - 1], endTime }
  }
  return { startTime, words }
}

export interface TimedSegment {
  text: string
  startTime: number
  endTime: number
}

export function timedSegmentsToLine(
  lineStart: number,
  lineEnd: number,
  segments: readonly TimedSegment[],
): ImportedLyricLine {
  const words: ImportedLyricWord[] = []
  let boundary = lineStart

  for (const segment of segments) {
    if (segment.startTime > boundary) {
      words.push({ text: '', endTime: segment.startTime })
    }
    words.push({ text: segment.text, endTime: segment.endTime })
    boundary = segment.endTime
  }

  if (lineEnd > boundary) {
    words.push({ text: '', endTime: lineEnd })
  }

  return { startTime: lineStart, words: words.length > 0 ? words : [{ text: '' }] }
}

export function lineText(line: { words: readonly { text: string }[] }): string {
  return line.words.map((word) => word.text).join('')
}

export function lineEndTime(line: {
  words: readonly { endTime?: number }[]
}): number | null {
  for (let index = line.words.length - 1; index >= 0; index -= 1) {
    const endTime = line.words[index].endTime
    if (endTime !== undefined) return endTime
  }
  return null
}
