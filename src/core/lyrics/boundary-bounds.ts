import type { LyricLine } from '../domain/project'

export const BOUNDARY_DRAG_EPSILON = 0.001

export type BoundaryDragIntent =
  | { kind: 'line-start'; lineId: string }
  | { kind: 'line-end'; lineId: string; wordId: string }
  | { kind: 'word-separator'; lineId: string; wordId: string }

export interface DragClampBounds {
  min: number
  max: number
}

export function getDragClampBounds(
  intent: BoundaryDragIntent,
  lyrics: readonly LyricLine[],
  duration: number,
): DragClampBounds {
  if (duration <= 0) return { min: 0, max: 0 }

  const lineIndex = lyrics.findIndex((line) => line.id === intent.lineId)
  if (lineIndex === -1) return { min: 0, max: duration }

  const line = lyrics[lineIndex]
  const rawBounds = _getRawBounds(intent, lyrics, lineIndex, line, duration)
  return _shrinkBounds(rawBounds, duration)
}

function _getRawBounds(
  intent: BoundaryDragIntent,
  lyrics: readonly LyricLine[],
  lineIndex: number,
  line: LyricLine,
  duration: number,
): DragClampBounds {
  if (intent.kind === 'line-start') {
    return {
      min: _getPreviousLineLastTimedEnd(lyrics, lineIndex) ?? 0,
      max: _getFirstTimedEnd(line) ?? _getNextLineStart(lyrics, lineIndex) ?? duration,
    }
  }

  const wordIndex = line.words.findIndex((word) => word.id === intent.wordId)
  if (wordIndex === -1) return { min: 0, max: duration }

  if (intent.kind === 'line-end') {
    return {
      min: _getWordStart(line, wordIndex) ?? 0,
      max: _getNextLineStart(lyrics, lineIndex) ?? duration,
    }
  }

  return {
    min: _getWordStart(line, wordIndex) ?? 0,
    max:
      _getNextTimedWordEnd(line, wordIndex) ??
      _getNextLineStart(lyrics, lineIndex) ??
      duration,
  }
}

function _getPreviousLineLastTimedEnd(
  lyrics: readonly LyricLine[],
  lineIndex: number,
): number | undefined {
  for (let i = lineIndex - 1; i >= 0; i--) {
    const end = _getLastTimedEnd(lyrics[i])
    if (end !== undefined) return end
  }
  return undefined
}

function _getNextLineStart(
  lyrics: readonly LyricLine[],
  lineIndex: number,
): number | undefined {
  for (let i = lineIndex + 1; i < lyrics.length; i++) {
    const start = lyrics[i].startTime
    if (start !== undefined) return start
  }
  return undefined
}

function _getFirstTimedEnd(line: LyricLine): number | undefined {
  return line.words.find((word) => word.endTime !== undefined)?.endTime
}

function _getLastTimedEnd(line: LyricLine): number | undefined {
  for (let i = line.words.length - 1; i >= 0; i--) {
    const end = line.words[i]?.endTime
    if (end !== undefined) return end
  }
  return undefined
}

function _getWordStart(line: LyricLine, wordIndex: number): number | undefined {
  if (wordIndex === 0) return line.startTime
  return line.words[wordIndex - 1]?.endTime
}

function _getNextTimedWordEnd(line: LyricLine, wordIndex: number): number | undefined {
  for (let i = wordIndex + 1; i < line.words.length; i++) {
    const end = line.words[i]?.endTime
    if (end !== undefined) return end
  }
  return undefined
}

function _shrinkBounds(bounds: DragClampBounds, duration: number): DragClampBounds {
  const min = Math.max(0, Math.min(duration, bounds.min + BOUNDARY_DRAG_EPSILON))
  const max = Math.max(0, Math.min(duration, bounds.max - BOUNDARY_DRAG_EPSILON))

  if (max < min) {
    const midpoint = (bounds.min + bounds.max) / 2
    const normalized = Math.max(0, Math.min(duration, midpoint))
    return { min: normalized, max: normalized }
  }

  return { min, max }
}
