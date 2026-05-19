import zhCN from '../../platform/i18n/locales/zh-CN.json'
import type { TimingPoint } from '../domain/project'
import { sortTimingPoints } from './timing-point'

// 1 nanosecond tolerance for floating-point comparisons in beat/bar arithmetic.
// About 7 orders larger than Number.EPSILON to handle accumulated rounding errors.
const BEAT_EPSILON = 1e-9
const SUBDIV_EPSILON = 1e-9

export interface BeatInfo {
  pointId: string
  beatIndex: number
  barIndex: number
  isBarStart: boolean
  beatTime: number
}

/**
 * Returns the active timing point for the given absolute time.
 *
 * - Points are sorted by time. point[i] governs interval [point[i].time, point[i+1].time).
 * - When t < first point's time, uses first point (backward projection).
 * - When t >= last point's time, uses last point.
 */
export function getActiveTimingPoint(
  points: readonly TimingPoint[],
  time: number,
): TimingPoint {
  const sorted = sortTimingPoints(points)

  if (sorted.length === 0) {
    throw new Error(zhCN.errors.noTimingPoints)
  }

  // Backward projection: time before first point
  if (time < sorted[0].time) {
    return sorted[0]
  }

  // Find the last point whose time <= queryTime
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].time <= time) {
      return sorted[i]
    }
  }

  // Fallback (shouldn't happen with above checks, but safe)
  return sorted[0]
}

/**
 * Returns the beat duration in seconds for the given BPM.
 * Beat duration (seconds) = 60 / bpm.
 */
function beatDuration(bpm: number): number {
  return 60 / bpm
}

/**
 * Returns the number of beats per bar for the given time signature.
 * Standard formula: numerator * 4 / denominator.
 *
 * - 4/4 → 4 beats per bar
 * - 3/4 → 3 beats per bar
 * - 6/8 → 3 beats per bar (quarter-note beats)
 */
function beatsPerBar(numerator: number, denominator: number): number {
  return (numerator * 4) / denominator
}

/**
 * Returns beat information at the given absolute time.
 *
 * Beat index is within the active timing point's segment (0-based at point.time).
 * Bar index is within the active timing point's segment.
 * Negative indices are possible for backward projection (time before point.time).
 */
export function getBeatInfoAtTime(
  points: readonly TimingPoint[],
  time: number,
): BeatInfo {
  const point = getActiveTimingPoint(points, time)
  const dur = beatDuration(point.bpm)
  const bpBar = beatsPerBar(
    point.timeSignatureNumerator,
    point.timeSignatureDenominator,
  )

  const elapsed = (time - point.time) / dur

  // Use epsilon to handle floating point near-exact beats
  const beatIdx = Math.floor(elapsed + BEAT_EPSILON)

  const barIdx = Math.floor(beatIdx / bpBar)
  const beatTimeAbs = point.time + beatIdx * dur

  return {
    pointId: point.id,
    beatIndex: beatIdx,
    barIndex: barIdx,
    isBarStart: beatIdx % bpBar === 0,
    beatTime: beatTimeAbs,
  }
}

/**
 * Returns the time of the next beat boundary strictly after the given time.
 *
 * When the computed next beat falls at or past a segment boundary (next timing point's start),
 * it returns the next timing point's start time instead.
 */
export function getNextBeatTime(points: readonly TimingPoint[], time: number): number {
  const sorted = sortTimingPoints(points)

  if (sorted.length === 0) {
    throw new Error(zhCN.errors.noTimingPoints)
  }

  const point = getActiveTimingPoint(sorted, time)
  const dur = beatDuration(point.bpm)

  const info = getBeatInfoAtTime(sorted, time)
  const nextBeatTime = info.beatTime + dur

  // Check if the next beat falls past the current segment boundary
  const pointIndex = sorted.findIndex((p) => p.id === point.id)
  if (pointIndex < sorted.length - 1) {
    const nextPoint = sorted[pointIndex + 1]
    if (nextBeatTime >= nextPoint.time) {
      return nextPoint.time
    }
  }

  return nextBeatTime
}

/**
 * Returns the time of the nearest previous bar boundary strictly before the given time.
 */
export function getPreviousBarTime(
  points: readonly TimingPoint[],
  time: number,
): number {
  const sorted = sortTimingPoints(points)
  const point = getActiveTimingPoint(sorted, time)
  const dur = beatDuration(point.bpm)
  const bpBar = beatsPerBar(
    point.timeSignatureNumerator,
    point.timeSignatureDenominator,
  )

  const elapsed = (time - point.time) / dur
  const beatIdx = Math.floor(elapsed + BEAT_EPSILON)
  const currentBarStartBeat = Math.floor(beatIdx / bpBar) * bpBar

  const currentBarStartTime = point.time + currentBarStartBeat * dur
  const isExactlyOnBarStart = Math.abs(time - currentBarStartTime) < BEAT_EPSILON

  const prevBarStartBeat = isExactlyOnBarStart
    ? currentBarStartBeat - bpBar
    : currentBarStartBeat

  const prevBarTime = point.time + prevBarStartBeat * dur

  // If the computed bar time falls before the current segment,
  // re-compute using the previous timing point's properties at the boundary.
  if (prevBarTime < point.time) {
    const pointIndex = sorted.findIndex((p) => p.id === point.id)
    if (pointIndex > 0) {
      const prevPoint = sorted[pointIndex - 1]
      const prevDur = beatDuration(prevPoint.bpm)
      const prevBpBar = beatsPerBar(
        prevPoint.timeSignatureNumerator,
        prevPoint.timeSignatureDenominator,
      )
      const boundaryElapsed = (point.time - prevPoint.time) / prevDur
      const boundaryBeatIdx = Math.floor(boundaryElapsed + BEAT_EPSILON)
      const boundaryBarStartBeat = Math.floor(boundaryBeatIdx / prevBpBar) * prevBpBar
      const boundaryBarStartTime = prevPoint.time + boundaryBarStartBeat * prevDur
      const isBoundaryOnBar = Math.abs(point.time - boundaryBarStartTime) < BEAT_EPSILON

      return isBoundaryOnBar
        ? prevPoint.time + (boundaryBarStartBeat - prevBpBar) * prevDur
        : prevPoint.time + boundaryBarStartBeat * prevDur
    }
  }

  return prevBarTime
}

/**
 * Returns the time of the next bar boundary strictly after the given time.
 */
export function getNextBarBoundaryTime(
  points: readonly TimingPoint[],
  time: number,
): number {
  const point = getActiveTimingPoint(points, time)
  const dur = beatDuration(point.bpm)
  const bpBar = beatsPerBar(
    point.timeSignatureNumerator,
    point.timeSignatureDenominator,
  )

  const elapsed = (time - point.time) / dur
  const beatIdx = Math.floor(elapsed + BEAT_EPSILON)
  const currentBarStartBeat = Math.floor(beatIdx / bpBar) * bpBar
  const nextBarStartBeat = currentBarStartBeat + bpBar

  return point.time + nextBarStartBeat * dur
}

export interface GridLine {
  time: number
  type: 'bar' | 'beat' | 'subdivision'
}

/**
 * Returns beat-grid lines within [startSec, endSec].
 * divisor: subdivisions per beat (1, 2, 4, 8, 16).
 * triplets: if true and divisor >= 2, actualDivisor = round(divisor * 3 / 2).
 * Returns [] when timingPoints is empty (never throws).
 */
export function getBeatGridLines(
  timingPoints: readonly TimingPoint[],
  divisor: number,
  triplets: boolean,
  startSec: number,
  endSec: number,
): GridLine[] {
  if (timingPoints.length === 0) return []

  const sorted = sortTimingPoints(timingPoints)
  const result: GridLine[] = []

  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i]
    const segStart = point.time
    const segEnd = i + 1 < sorted.length ? sorted[i + 1].time : Infinity

    // Skip segments entirely outside the window
    if (segEnd <= startSec || segStart >= endSec) continue

    const beatDur = 60 / point.bpm
    const bpBar = (point.timeSignatureNumerator * 4) / point.timeSignatureDenominator
    const actualDivisor =
      triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
    const subDur = beatDur / actualDivisor

    const windowStart = Math.max(segStart, startSec)
    const windowEnd = Math.min(segEnd === Infinity ? endSec : segEnd, endSec)

    // First sub index at or after windowStart (relative to segStart)
    const rawStart = (windowStart - segStart) / subDur
    let subIdx = Math.max(0, Math.ceil(rawStart - SUBDIV_EPSILON))

    while (true) {
      const t = segStart + subIdx * subDur
      if (t >= windowEnd - SUBDIV_EPSILON) break

      if (t >= windowStart - SUBDIV_EPSILON) {
        const barsPerSeg = bpBar * actualDivisor
        let type: 'bar' | 'beat' | 'subdivision'
        if (subIdx % barsPerSeg === 0) {
          type = 'bar'
        } else if (subIdx % actualDivisor === 0) {
          type = 'beat'
        } else {
          type = 'subdivision'
        }
        result.push({ time: t, type })
      }
      subIdx++
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

/**
 * Returns the time of the next subdivision boundary strictly after `time`.
 * Uses the same triplets formula as getBeatGridLines.
 * Throws if timingPoints is empty.
 */
export function getNextSubdivisionTime(
  points: readonly TimingPoint[],
  time: number,
  divisor: number,
  triplets: boolean,
): number {
  const sorted = sortTimingPoints(points)
  if (sorted.length === 0) throw new Error(zhCN.errors.noTimingPoints)

  const point = getActiveTimingPoint(sorted, time)
  const beatDur = 60 / point.bpm
  const actualDivisor =
    triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
  const subDur = beatDur / actualDivisor

  const elapsed = (time - point.time) / subDur
  const subIdx = Math.floor(elapsed + BEAT_EPSILON)
  const nextSubTime = point.time + (subIdx + 1) * subDur

  // Cross-segment boundary check
  const pointIndex = sorted.findIndex((p) => p.id === point.id)
  if (pointIndex < sorted.length - 1) {
    const nextPoint = sorted[pointIndex + 1]
    if (nextSubTime >= nextPoint.time) {
      return nextPoint.time
    }
  }

  return nextSubTime
}

/**
 * Returns the start time of the subdivision containing `time`,
 * or the previous subdivision if `time` is exactly on a boundary.
 * Throws if timingPoints is empty.
 */
export function getPreviousSubdivisionTime(
  points: readonly TimingPoint[],
  time: number,
  divisor: number,
  triplets: boolean,
): number {
  const sorted = sortTimingPoints(points)
  if (sorted.length === 0) throw new Error(zhCN.errors.noTimingPoints)

  const point = getActiveTimingPoint(sorted, time)
  const beatDur = 60 / point.bpm
  const actualDivisor =
    triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
  const subDur = beatDur / actualDivisor

  const elapsed = (time - point.time) / subDur
  const subIdx = Math.floor(elapsed + BEAT_EPSILON)
  const currentSubStart = point.time + subIdx * subDur
  const isExactlyOnSub = Math.abs(time - currentSubStart) < BEAT_EPSILON

  return isExactlyOnSub ? point.time + (subIdx - 1) * subDur : currentSubStart
}
