import { describe, expect, it } from 'vitest'

import type { TimingPoint } from '../domain/project'
import { clampWordTime, computeSnappedTime } from './snap-time'

const points: TimingPoint[] = [
  {
    id: 'tp-1',
    time: 0,
    bpm: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
  },
]
// 120 BPM, divisor 4 → grid interval = 0.125s

describe('computeSnappedTime', () => {
  it('returns raw time when snap is disabled', () => {
    const result = computeSnappedTime({
      rawTime: 0.13,
      snapEnabled: false,
      timingPoints: points,
      divisor: 4,
      triplets: false,
      existingEndTimes: [],
    })
    expect(result).toBe(0.13)
  })

  it('snaps to nearest grid point when snap is enabled', () => {
    const result = computeSnappedTime({
      rawTime: 0.13,
      snapEnabled: true,
      timingPoints: points,
      divisor: 4,
      triplets: false,
      existingEndTimes: [],
    })
    expect(result).toBeCloseTo(0.125, 6)
  })

  it('finds alternative grid point when candidate is occupied', () => {
    const result = computeSnappedTime({
      rawTime: 0.13,
      snapEnabled: true,
      timingPoints: points,
      divisor: 4,
      triplets: false,
      existingEndTimes: [0.125],
    })
    expect(result).toBe(0.13)
  })

  it('snaps to unoccupied nearby grid point if available', () => {
    const result = computeSnappedTime({
      rawTime: 0.26,
      snapEnabled: true,
      timingPoints: points,
      divisor: 2,
      triplets: false,
      existingEndTimes: [0.25],
    })
    expect(result).toBe(0.26)
  })
})

describe('clampWordTime', () => {
  it('returns time unchanged when valid', () => {
    expect(clampWordTime(1.5, 0.5, 120)).toBe(1.5)
  })

  it('clamps to 0 when negative', () => {
    expect(clampWordTime(-0.5, undefined, 120)).toBe(0)
  })

  it('clamps to audioDuration when exceeded', () => {
    expect(clampWordTime(200, undefined, 120)).toBe(120)
  })

  it('clamps to prevEndTime + 0.001 when <= prevEndTime', () => {
    expect(clampWordTime(1.0, 1.0, 120)).toBeCloseTo(1.001, 6)
    expect(clampWordTime(0.5, 1.0, 120)).toBeCloseTo(1.001, 6)
  })

  it('returns prevEndTime + 0.001 when undefined prevEndTime and time is valid', () => {
    expect(clampWordTime(0.5, undefined, 120)).toBe(0.5)
  })
})
