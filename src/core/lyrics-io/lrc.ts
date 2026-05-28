import { lineText, textToUntimedWords } from './line-builder'
import { formatLrcTime, parseLrcTime } from './time'
import type {
  ImportedLyricLine,
  ImportedLyricWord,
  LyricsFormatAdapter,
  LyricsParseOptions,
} from './types'

interface ParsedLrcLine {
  lineStart: number
  body: string
  inline: Array<{ time: number; text: string }>
  explicitEnd?: number
}

type ParsedLrcEntry =
  | { kind: 'line'; line: ParsedLrcLine }
  | { kind: 'boundary'; time: number }

interface TimedSegmentStart {
  time: number
  text: string
  isTrailingBoundary: boolean
}

const LINE_TIME_RE = /^\[(\d+:[0-5]\d(?:[.:]\d{1,3})?)\](.*)$/
const ANGLE_TOKEN_RE = /<(\d+:[0-5]\d(?:[.:]\d{1,3})?)>/g
const SQUARE_TOKEN_RE = /\[(\d+:[0-5]\d(?:[.:]\d{1,3})?)\]/g

function parseInlineSegments(body: string, re: RegExp): TimedSegmentStart[] {
  const matches = [...body.matchAll(re)]
  if (matches.length === 0) return []
  return matches.map((match, index) => {
    const time = parseLrcTime(match[1])
    const textStart = (match.index ?? 0) + match[0].length
    const textEnd = matches[index + 1]?.index ?? body.length
    const text = body.slice(textStart, textEnd)
    return {
      time: time ?? 0,
      text,
      isTrailingBoundary: index === matches.length - 1 && text.length === 0,
    }
  })
}

function normalizeInlineSegments(segments: TimedSegmentStart[]): {
  inline: Array<{ time: number; text: string }>
  explicitEnd?: number
} {
  const trailing = segments.at(-1)
  if (!trailing?.isTrailingBoundary) {
    return { inline: segments.map(({ time, text }) => ({ time, text })) }
  }
  return {
    inline: segments
      .slice(0, -1)
      .map(({ time, text }) => ({ time, text }))
      .filter((segment) => segment.text.length > 0),
    explicitEnd: trailing.time,
  }
}

function parseEntry(rawLine: string): ParsedLrcEntry | null {
  const match = LINE_TIME_RE.exec(rawLine.trim())
  if (!match) return null
  const lineStart = parseLrcTime(match[1])
  if (lineStart === null) return null
  const body = match[2] ?? ''
  if (body.length === 0) return { kind: 'boundary', time: lineStart }
  const angle = normalizeInlineSegments(parseInlineSegments(body, ANGLE_TOKEN_RE))
  if (angle.inline.length > 0 || angle.explicitEnd !== undefined) {
    return { kind: 'line', line: { lineStart, body, ...angle } }
  }
  const square = normalizeInlineSegments(parseInlineSegments(body, SQUARE_TOKEN_RE))
  if (square.inline.length > 0 || square.explicitEnd !== undefined) {
    const firstSquare = body.search(SQUARE_TOKEN_RE)
    const prefix = firstSquare > 0 ? body.slice(0, firstSquare) : ''
    const inline = prefix
      ? [{ time: lineStart, text: prefix }, ...square.inline]
      : square.inline
    return {
      kind: 'line',
      line: {
        lineStart,
        body,
        inline,
        explicitEnd: square.explicitEnd,
      },
    }
  }
  return { kind: 'line', line: { lineStart, body, inline: [] } }
}

function finalEndForLine(
  line: ParsedLrcLine,
  nextLine: ParsedLrcLine | undefined,
  options: LyricsParseOptions | undefined,
): number {
  if (line.explicitEnd !== undefined) return line.explicitEnd
  if (nextLine) return nextLine.lineStart
  if (options?.audioDuration !== undefined) return options.audioDuration
  const last = line.inline[line.inline.length - 1]
  return (last?.time ?? line.lineStart) + 1
}

function wordsFromInlineLine(
  line: ParsedLrcLine,
  nextLine: ParsedLrcLine | undefined,
  options: LyricsParseOptions | undefined,
): ImportedLyricWord[] {
  return line.inline.map((segment, index) => ({
    text: segment.text,
    endTime: line.inline[index + 1]?.time ?? finalEndForLine(line, nextLine, options),
  }))
}

export const lrcAdapter: LyricsFormatAdapter = {
  id: 'lrc',
  label: 'LRC',
  extension: 'lrc',
  parse(text, options) {
    const entries = text
      .split(/\r?\n/)
      .map(parseEntry)
      .filter((entry): entry is ParsedLrcEntry => entry !== null)

    const parsed: ParsedLrcLine[] = []
    for (const entry of entries) {
      if (entry.kind === 'boundary') {
        const previous = parsed.at(-1)
        if (previous && previous.explicitEnd === undefined) {
          previous.explicitEnd = entry.time
        }
        continue
      }
      parsed.push(entry.line)
    }

    const lines: ImportedLyricLine[] = parsed.flatMap((line, index) => {
      if (line.inline.length > 0) {
        return [
          {
            startTime: line.lineStart,
            words: wordsFromInlineLine(line, parsed[index + 1], options),
          },
        ]
      }
      const words = textToUntimedWords(line.body)
      if (words.length === 0) return []
      if (line.explicitEnd !== undefined) {
        words[words.length - 1] = {
          ...words[words.length - 1],
          endTime: line.explicitEnd,
        }
      }
      return [
        {
          startTime: line.lineStart,
          words,
        },
      ]
    })
    return { lines }
  },
  export(input, options) {
    const wordTiming = options?.lrcWordTiming ?? 'angle'
    return input.project.lyrics
      .filter((line) => line.startTime !== undefined)
      .map((line) => {
        const prefix = formatLrcTime(line.startTime ?? 0)
        const lineEnd = line.words.at(-1)?.endTime
        if (wordTiming === 'line') {
          const lineBody = `${prefix}${lineText(line)}`
          return lineEnd !== undefined && lineEnd !== line.startTime
            ? `${lineBody}\n${formatLrcTime(lineEnd)}`
            : lineBody
        }
        const hasAllEnds = line.words.every((word) => word.endTime !== undefined)
        if (!hasAllEnds) return `${prefix}${lineText(line)}`
        let start = line.startTime ?? 0
        const body = line.words
          .map((word) => {
            const tag =
              wordTiming === 'square'
                ? formatLrcTime(start)
                : formatLrcTime(start).replace('[', '<').replace(']', '>')
            start = word.endTime ?? start
            return `${tag}${word.text}`
          })
          .join('')
        const endTag =
          wordTiming === 'square'
            ? formatLrcTime(start)
            : formatLrcTime(start).replace('[', '<').replace(']', '>')
        return `${prefix}${body}${endTag}`
      })
      .join('\n')
  },
}
