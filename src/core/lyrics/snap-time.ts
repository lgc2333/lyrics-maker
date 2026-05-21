import type { TimingPoint } from '../domain/project'
import {
  getActiveTimingPoint,
  getBeatGridLines,
  snapToNearestGridPoint,
} from '../timing/timing-engine'

export interface ComputeSnappedTimeOptions {
  rawTime: number
  snapEnabled: boolean
  timingPoints: readonly TimingPoint[]
  divisor: number
  triplets: boolean
  existingEndTimes: readonly number[]
}

const OCCUPIED_THRESHOLD = 0.001

function isOccupied(time: number, endTimes: readonly number[]): boolean {
  return endTimes.some((t) => Math.abs(t - time) < OCCUPIED_THRESHOLD)
}

export function computeSnappedTime(options: ComputeSnappedTimeOptions): number {
  const { rawTime, snapEnabled, timingPoints, divisor, triplets, existingEndTimes } =
    options
  if (!snapEnabled || timingPoints.length === 0) return rawTime

  const candidate = snapToNearestGridPoint(timingPoints, rawTime, divisor, triplets)

  if (!isOccupied(candidate, existingEndTimes)) return candidate

  // Anti-overlap: search within gridInterval/4 radius for an unoccupied grid point
  const activePoint = getActiveTimingPoint(timingPoints, rawTime)
  const beatDur = 60 / activePoint.bpm
  const actualDivisor =
    triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
  const gridInterval = beatDur / actualDivisor
  const radius = gridInterval / 4

  const searchStart = candidate - radius
  const searchEnd = candidate + radius
  const gridLines = getBeatGridLines(
    timingPoints,
    divisor,
    triplets,
    searchStart,
    searchEnd,
  )

  let bestTime: number | null = null
  let bestDist = Infinity
  for (const gl of gridLines) {
    if (
      !isOccupied(gl.time, existingEndTimes) &&
      Math.abs(gl.time - candidate) < bestDist
    ) {
      bestDist = Math.abs(gl.time - candidate)
      bestTime = gl.time
    }
  }

  return bestTime ?? rawTime
}

export function clampWordTime(
  time: number,
  prevEndTime: number | undefined,
  audioDuration: number,
): number {
  let t = Math.max(0, Math.min(audioDuration, time))
  if (prevEndTime !== undefined && t <= prevEndTime) {
    t = prevEndTime + 0.001
  }
  return t
}
