import type { TimingPoint } from '../domain/project'
import { sortTimingPoints } from './timing-point'

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
    throw new Error('Cannot get active timing point: no timing points available')
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

  // Offset shifts the query time relative to the beat grid
  const effectiveTime = time + point.offsetMs / 1000

  // Elapsed beats from segment start (point.time is absolute, no offset)
  const elapsed = (effectiveTime - point.time) / dur

  // Use epsilon to handle floating point near-exact beats
  const beatIdx = Math.floor(elapsed + 1e-9)

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
    throw new Error('Cannot get next beat time: no timing points available')
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
  const point = getActiveTimingPoint(points, time)
  const dur = beatDuration(point.bpm)
  const bpBar = beatsPerBar(
    point.timeSignatureNumerator,
    point.timeSignatureDenominator,
  )

  // Effective time with offset
  const effectiveTime = time + point.offsetMs / 1000
  const elapsed = (effectiveTime - point.time) / dur
  const beatIdx = Math.floor(elapsed + 1e-9)
  const currentBarStartBeat = Math.floor(beatIdx / bpBar) * bpBar

  let prevBarStartBeat: number
  if (beatIdx === currentBarStartBeat) {
    // We're exactly on a bar boundary — go to previous bar
    prevBarStartBeat = currentBarStartBeat - bpBar
  } else {
    prevBarStartBeat = currentBarStartBeat
  }

  return point.time + prevBarStartBeat * dur
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

  const effectiveTime = time + point.offsetMs / 1000
  const elapsed = (effectiveTime - point.time) / dur
  const beatIdx = Math.floor(elapsed + 1e-9)
  const currentBarStartBeat = Math.floor(beatIdx / bpBar) * bpBar
  const nextBarStartBeat = currentBarStartBeat + bpBar

  return point.time + nextBarStartBeat * dur
}
