import { parse as parseAss, stringify as stringifyAss } from 'ass-compiler'
import type { ParsedASS } from 'ass-compiler'

import { lineEndTime, lineText, textIntervalToLine } from './line-builder'
import { formatSubtitleTime, parseSubtitleTime } from './time'
import type { LyricsFormatAdapter } from './types'

function cleanSubtitleText(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\\N/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

type AssDialogueText = ParsedASS['events']['dialogue'][number]['Text']

function escapeAssText(text: string): string {
  return text.replace(/\n/g, '\\N')
}

function parseAssKaraokeLine(
  fragments: ParsedASS['events']['dialogue'][number]['Text']['parsed'],
  startTime: number,
  endTime: number,
): ReturnType<typeof textIntervalToLine> | null {
  if (
    !fragments.some((fragment) =>
      fragment.tags.some((tag) => karaokeDuration(tag) !== null),
    )
  ) {
    return null
  }

  const words = []
  let boundaryCs = Math.round(startTime * 100)
  const endCs = Math.round(endTime * 100)
  for (const [index, fragment] of fragments.entries()) {
    const duration =
      fragment.tags.map(karaokeDuration).find((value) => value !== null) ?? 0
    const wordText = fragment.text
    if (wordText.length === 0) {
      boundaryCs += duration
      continue
    }
    const wordEndCs = index === fragments.length - 1 ? endCs : boundaryCs + duration
    words.push({ text: wordText, endTime: wordEndCs / 100 })
    boundaryCs = wordEndCs
  }

  return { startTime, words: words.length > 0 ? words : [{ text: '', endTime }] }
}

function karaokeDuration(
  tag: ParsedASS['events']['dialogue'][number]['Text']['parsed'][number]['tags'][number],
): number | null {
  return tag.k ?? tag.K ?? tag.kf ?? tag.ko ?? null
}

function buildAssDialogueText(line: {
  startTime?: number
  words: readonly { text: string; endTime?: number }[]
}): AssDialogueText {
  let boundary = line.startTime
  const fallbackText = escapeAssText(lineText(line))
  if (boundary === undefined) {
    return {
      raw: fallbackText,
      combined: fallbackText,
      parsed: [{ tags: [], text: fallbackText, drawing: [] }],
    }
  }

  const parsed: AssDialogueText['parsed'] = []
  for (const word of line.words) {
    if (word.endTime === undefined) {
      return {
        raw: fallbackText,
        combined: fallbackText,
        parsed: [{ tags: [], text: fallbackText, drawing: [] }],
      }
    }
    const durationCs = Math.max(0, Math.round((word.endTime - boundary) * 100))
    parsed.push({
      tags: [{ k: durationCs }],
      text: escapeAssText(word.text),
      drawing: [],
    })
    boundary = word.endTime
  }

  return {
    raw: fallbackText,
    combined: fallbackText,
    parsed,
  }
}

const assStyleFormat = [
  'Name',
  'Fontname',
  'Fontsize',
  'PrimaryColour',
  'SecondaryColour',
  'OutlineColour',
  'BackColour',
  'Bold',
  'Italic',
  'Underline',
  'StrikeOut',
  'ScaleX',
  'ScaleY',
  'Spacing',
  'Angle',
  'BorderStyle',
  'Outline',
  'Shadow',
  'Alignment',
  'MarginL',
  'MarginR',
  'MarginV',
  'Encoding',
]

const defaultAssStyle = {
  Name: 'Default',
  Fontname: 'Arial',
  Fontsize: '20',
  PrimaryColour: '&H00FFFFFF&',
  SecondaryColour: '&H000000FF&',
  OutlineColour: '&H00000000&',
  BackColour: '&H00000000&',
  Bold: '0',
  Italic: '0',
  Underline: '0',
  StrikeOut: '0',
  ScaleX: '100',
  ScaleY: '100',
  Spacing: '0',
  Angle: '0',
  BorderStyle: '1',
  Outline: '2',
  Shadow: '2',
  Alignment: '2',
  MarginL: '10',
  MarginR: '10',
  MarginV: '10',
  Encoding: '1',
}

export const srtAdapter: LyricsFormatAdapter = {
  id: 'srt',
  label: 'SRT',
  extension: 'srt',
  parse(text) {
    const blocks = text.trim().split(/\r?\n\r?\n/)
    const lines = blocks
      .map((block) => {
        const rows = block.split(/\r?\n/)
        const timeRow = rows.find((row) => row.includes('-->'))
        if (!timeRow) return null
        const [startRaw, endRaw] = timeRow.split('-->').map((part) => part.trim())
        const start = parseSubtitleTime(startRaw)
        const end = parseSubtitleTime(endRaw.split(/\s+/)[0])
        if (start === null || end === null) return null
        const textRows = rows.slice(rows.indexOf(timeRow) + 1)
        return textIntervalToLine(cleanSubtitleText(textRows.join('\n')), start, end)
      })
      .filter((line): line is NonNullable<typeof line> => line !== null)
    return { lines }
  },
  export(input) {
    return input.project.lyrics
      .filter((line) => line.startTime !== undefined && lineEndTime(line) !== null)
      .map((line, index) => {
        const start = line.startTime ?? 0
        const end = lineEndTime(line) ?? start
        return `${index + 1}\n${formatSubtitleTime(start, ',')} --> ${formatSubtitleTime(end, ',')}\n${lineText(line)}`
      })
      .join('\n\n')
  },
}

export const vttAdapter: LyricsFormatAdapter = {
  id: 'vtt',
  label: 'WebVTT',
  extension: 'vtt',
  parse(text) {
    const withoutHeader = text.replace(/^WEBVTT[^\n]*(?:\r?\n){1,2}/i, '')
    return srtAdapter.parse(withoutHeader.replace(/(\d\d:\d\d:\d\d)\./g, '$1.'))
  },
  export(input) {
    const cues = input.project.lyrics
      .filter((line) => line.startTime !== undefined && lineEndTime(line) !== null)
      .map((line) => {
        const start = line.startTime ?? 0
        const end = lineEndTime(line) ?? start
        return `${formatSubtitleTime(start, '.')} --> ${formatSubtitleTime(end, '.')}\n${lineText(line)}`
      })
      .join('\n\n')
    return `WEBVTT\n\n${cues}\n`
  },
}

export const assAdapter: LyricsFormatAdapter = {
  id: 'ass',
  label: 'ASS',
  extension: 'ass',
  parse(text) {
    const ass = parseAss(text)
    const lines = ass.events.dialogue
      .map((dialogue) => {
        const start = dialogue.Start
        const end = dialogue.End
        if (typeof start !== 'number' || typeof end !== 'number') return null
        return (
          parseAssKaraokeLine(dialogue.Text.parsed, start, end) ??
          textIntervalToLine(cleanSubtitleText(dialogue.Text.raw), start, end)
        )
      })
      .filter((line): line is NonNullable<typeof line> => line !== null)
    return { lines }
  },
  export(input) {
    const dialogue = input.project.lyrics
      .filter((line) => line.startTime !== undefined && lineEndTime(line) !== null)
      .map((line) => {
        const start = line.startTime ?? 0
        const end = lineEndTime(line) ?? start
        return {
          Layer: 0,
          Start: start,
          End: end,
          Style: 'Default',
          Name: '',
          MarginL: 0,
          MarginR: 0,
          MarginV: 0,
          Text: buildAssDialogueText(line),
        }
      })
    return stringifyAss({
      info: {
        Title: 'Lyrics Maker Export',
        ScriptType: 'v4.00+',
        WrapStyle: '0',
        PlayResX: '1280',
        PlayResY: '720',
        ScaledBorderAndShadow: 'yes',
        Collisions: 'Normal',
      },
      styles: {
        format: assStyleFormat,
        style: [defaultAssStyle],
      },
      events: {
        format: [
          'Layer',
          'Start',
          'End',
          'Style',
          'Name',
          'MarginL',
          'MarginR',
          'MarginV',
          'Effect',
          'Text',
        ],
        comment: [],
        dialogue,
      },
    })
  },
}
