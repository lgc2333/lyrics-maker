import { describe, expect, it } from 'vitest'

import type { TimingPoint } from '../domain/project'
import { TIMING_ERRORS } from './errors'
import {
  getActiveTimingPoint,
  getBeatGridLines,
  getBeatInfoAtTime,
  getNextBarBoundaryTime,
  getNextBeatTime,
  getNextSubdivisionTime,
  getPreviousBarTime,
  getPreviousSubdivisionTime,
  snapToNearestGridPoint,
} from './timing-engine'
import { sortTimingPoints, validateTimingPoint } from './timing-point'

// Helper to create a TimingPoint with minimal fields
function tp(overrides: Partial<TimingPoint> & { id: string }): TimingPoint {
  return {
    time: 0,
    bpm: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    ...overrides,
  }
}

// ============================================================
// sortTimingPoints
// ============================================================
describe('sortTimingPoints', () => {
  it('sorts points by time ascending', () => {
    const points: TimingPoint[] = [
      tp({ id: '3', time: 30 }),
      tp({ id: '1', time: 10 }),
      tp({ id: '2', time: 20 }),
    ]
    const sorted = sortTimingPoints(points)
    expect(sorted.map((p) => p.time)).toEqual([10, 20, 30])
    expect(sorted.map((p) => p.id)).toEqual(['1', '2', '3'])
  })

  it('maintains order for same time', () => {
    const points: TimingPoint[] = [tp({ id: 'a', time: 10 }), tp({ id: 'b', time: 10 })]
    const sorted = sortTimingPoints(points)
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('returns empty array for empty input', () => {
    expect(sortTimingPoints([])).toEqual([])
  })

  it('returns new array, does not mutate input', () => {
    const points: TimingPoint[] = [tp({ id: '2', time: 20 }), tp({ id: '1', time: 10 })]
    const original = [...points]
    sortTimingPoints(points)
    expect(points).toEqual(original)
  })
})

// ============================================================
// validateTimingPoint
// ============================================================
describe('validateTimingPoint', () => {
  it('returns no errors for a valid point', () => {
    const point = tp({ id: 'tp-1', time: 0, bpm: 120 })
    expect(validateTimingPoint(point)).toEqual([])
  })

  it('returns error for bpm <= 0', () => {
    const point = tp({ id: 'tp-1', bpm: 0 })
    expect(validateTimingPoint(point)).toContain(TIMING_ERRORS.invalidBpm)
  })

  it('returns error for negative bpm', () => {
    const point = tp({ id: 'tp-1', bpm: -10 })
    expect(validateTimingPoint(point)).toContain(TIMING_ERRORS.invalidBpm)
  })

  it('returns error for NaN bpm', () => {
    const point = tp({ id: 'tp-1', bpm: Number.NaN })
    expect(validateTimingPoint(point)).toContain(TIMING_ERRORS.invalidBpm)
  })

  it('returns error for Infinity bpm', () => {
    const point = tp({ id: 'tp-1', bpm: Infinity })
    expect(validateTimingPoint(point)).toContain(TIMING_ERRORS.invalidBpm)
  })

  it('returns error for non-positive numerator', () => {
    const point = tp({ id: 'tp-1', timeSignatureNumerator: 0 })
    expect(validateTimingPoint(point)).toContain(
      TIMING_ERRORS.timeSignatureNumeratorMustBePositive,
    )
  })

  it('returns error for non-positive denominator', () => {
    const point = tp({ id: 'tp-1', timeSignatureDenominator: 0 })
    expect(validateTimingPoint(point)).toContain(
      TIMING_ERRORS.timeSignatureDenominatorMustBePositive,
    )
  })

  it('returns multiple errors for multiple issues', () => {
    const point = tp({
      id: 'tp-1',
      bpm: -1,
      timeSignatureNumerator: 0,
      timeSignatureDenominator: 0,
    })
    const errors = validateTimingPoint(point)
    expect(errors).toHaveLength(3)
  })

  it('handles partial timing points (missing fields are not validated)', () => {
    const errors = validateTimingPoint({ bpm: -1 })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe(TIMING_ERRORS.invalidBpm)
  })
})

// ============================================================
// getActiveTimingPoint
// ============================================================
describe('getActiveTimingPoint', () => {
  it('returns the timing point for time within its segment', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0 })]
    const result = getActiveTimingPoint(points, 5)
    expect(result.id).toBe('tp-1')
  })

  it('returns first point for times before first point by backward projection', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 10 })]
    const result = getActiveTimingPoint(points, 5)
    expect(result.id).toBe('tp-1')
  })

  it('returns last point for times after last point', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0 })]
    const result = getActiveTimingPoint(points, 100)
    expect(result.id).toBe('tp-1')
  })

  it('returns correct point when time falls between two points', () => {
    const points: TimingPoint[] = [
      tp({ id: 'tp-1', time: 0 }),
      tp({ id: 'tp-2', time: 30 }),
    ]
    expect(getActiveTimingPoint(points, 10).id).toBe('tp-1')
    expect(getActiveTimingPoint(points, 40).id).toBe('tp-2')
  })

  it('returns second point when time exactly equals its start', () => {
    const points: TimingPoint[] = [
      tp({ id: 'tp-1', time: 0 }),
      tp({ id: 'tp-2', time: 30 }),
    ]
    const result = getActiveTimingPoint(points, 30)
    expect(result.id).toBe('tp-2')
  })

  it('works with unsorted input points', () => {
    const points: TimingPoint[] = [
      tp({ id: 'tp-2', time: 30 }),
      tp({ id: 'tp-1', time: 0 }),
    ]
    expect(getActiveTimingPoint(points, 10).id).toBe('tp-1')
    expect(getActiveTimingPoint(points, 30).id).toBe('tp-2')
  })

  it('returns the first point when at exact boundary and only one point exists', () => {
    const points: TimingPoint[] = [tp({ id: 'only', time: 100 })]
    const result = getActiveTimingPoint(points, 100)
    expect(result.id).toBe('only')
  })

  it('handles three points correctly', () => {
    const points: TimingPoint[] = [
      tp({ id: 'p1', time: 0 }),
      tp({ id: 'p2', time: 20 }),
      tp({ id: 'p3', time: 40 }),
    ]
    expect(getActiveTimingPoint(points, 0).id).toBe('p1')
    expect(getActiveTimingPoint(points, 19.999).id).toBe('p1')
    expect(getActiveTimingPoint(points, 20).id).toBe('p2')
    expect(getActiveTimingPoint(points, 30).id).toBe('p2')
    expect(getActiveTimingPoint(points, 40).id).toBe('p3')
    expect(getActiveTimingPoint(points, 50).id).toBe('p3')
  })
})

// ============================================================
// getBeatInfoAtTime
// ============================================================
describe('getBeatInfoAtTime', () => {
  // --- Basic cases ---
  it('returns beat 0 at the timing point start time', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    const info = getBeatInfoAtTime(points, 0)
    expect(info.pointId).toBe('tp-1')
    expect(info.beatIndex).toBe(0)
    expect(info.barIndex).toBe(0)
    expect(info.isBarStart).toBe(true)
    expect(info.beatTime).toBe(0)
  })

  it('returns correct beat info at 4/4 120bpm 1 second = beat 2', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    // beat duration = 60/120 = 0.5s, so 1.0s = beat 2
    const info = getBeatInfoAtTime(points, 1.0)
    expect(info.beatIndex).toBe(2)
    expect(info.barIndex).toBe(0)
    expect(info.isBarStart).toBe(false)
    expect(info.beatTime).toBe(1.0)
  })

  it('detects bar start correctly at 4/4 (every 4th beat)', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    // beat duration = 0.5s
    // beat 0 = 0.0s (bar 0 start)
    // beat 4 = 2.0s (bar 1 start)
    // beat 8 = 4.0s (bar 2 start)
    expect(getBeatInfoAtTime(points, 0.0).isBarStart).toBe(true)
    expect(getBeatInfoAtTime(points, 0.5).isBarStart).toBe(false)
    expect(getBeatInfoAtTime(points, 1.0).isBarStart).toBe(false)
    expect(getBeatInfoAtTime(points, 1.5).isBarStart).toBe(false)
    expect(getBeatInfoAtTime(points, 2.0).isBarStart).toBe(true)
    expect(getBeatInfoAtTime(points, 4.0).isBarStart).toBe(true)
  })

  it('computes correct barIndex for 4/4', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    expect(getBeatInfoAtTime(points, 0.0).barIndex).toBe(0) // beats 0-3: bar 0
    expect(getBeatInfoAtTime(points, 2.0).barIndex).toBe(1) // beats 4-7: bar 1
    expect(getBeatInfoAtTime(points, 4.0).barIndex).toBe(2) // beats 8-11: bar 2
  })

  // --- Time between beats ---
  it('returns the beat that contains the given time (floor behavior)', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    // beat duration = 0.5s
    // time 0.3s is during beat 0 (0.0 - 0.5)
    const info = getBeatInfoAtTime(points, 0.3)
    expect(info.beatIndex).toBe(0)
    expect(info.beatTime).toBe(0.0)
  })

  // --- 3/4 time signature ---
  it('handles 3/4 time signature correctly', () => {
    const points: TimingPoint[] = [
      tp({
        id: 'tp-1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 3,
        timeSignatureDenominator: 4,
      }),
    ]
    // beat duration = 0.5s, beats per bar = 3
    expect(getBeatInfoAtTime(points, 0.0).isBarStart).toBe(true) // beat 0
    expect(getBeatInfoAtTime(points, 0.5).isBarStart).toBe(false) // beat 1
    expect(getBeatInfoAtTime(points, 1.0).isBarStart).toBe(false) // beat 2
    expect(getBeatInfoAtTime(points, 1.5).isBarStart).toBe(true) // beat 3 = bar 1 start
    expect(getBeatInfoAtTime(points, 1.5).barIndex).toBe(1)
  })

  // --- 6/8 time signature ---
  it('handles 6/8 time signature correctly', () => {
    const points: TimingPoint[] = [
      tp({
        id: 'tp-1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 6,
        timeSignatureDenominator: 8,
      }),
    ]
    // beat duration = 60/120 = 0.5s (quarter note)
    // beats per bar = 6 * 4 / 8 = 3
    expect(getBeatInfoAtTime(points, 0.0).isBarStart).toBe(true) // beat 0
    expect(getBeatInfoAtTime(points, 0.5).isBarStart).toBe(false) // beat 1
    expect(getBeatInfoAtTime(points, 1.0).isBarStart).toBe(false) // beat 2
    expect(getBeatInfoAtTime(points, 1.5).isBarStart).toBe(true) // beat 3
    expect(getBeatInfoAtTime(points, 0.0).barIndex).toBe(0)
    expect(getBeatInfoAtTime(points, 1.5).barIndex).toBe(1)
  })

  // --- Backward projection ---
  it('uses first timing point for times before first point', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 10, bpm: 120 })]
    const info = getBeatInfoAtTime(points, 9.5)
    expect(info.pointId).toBe('tp-1')
  })

  it('computes negative beat indices for backward projection', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 10, bpm: 120 })]
    // beat duration = 0.5s
    // effective_time(9.5) = 9.5, elapsed = (9.5 - 10)/0.5 = -1.0
    const info = getBeatInfoAtTime(points, 9.5)
    expect(info.beatIndex).toBe(-1)
    expect(info.beatTime).toBe(9.5)
  })

  it('backward projection preserves bar start detection', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 10, bpm: 120 })]
    // beat 0 = 10.0s, beat -4 = 8.0s (should be bar start)
    expect(getBeatInfoAtTime(points, 8.0).isBarStart).toBe(true)
    expect(getBeatInfoAtTime(points, 8.0).barIndex).toBe(-1)
    // beat -2 = 9.0s (not bar start, in bar -1)
    const infoAt9 = getBeatInfoAtTime(points, 9.0)
    expect(infoAt9.isBarStart).toBe(false)
    expect(infoAt9.barIndex).toBe(-1)
  })

  // --- Floating point precision ---
  it('handles floating point near-exact beats correctly', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    // 1.0 should be exactly beat 2, but might be 1.999999999 internally
    const info = getBeatInfoAtTime(points, 1.0)
    expect(info.beatIndex).toBe(2)
  })

  it('handles very small times near zero', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    const info = getBeatInfoAtTime(points, 1e-10)
    expect(info.beatIndex).toBe(0)
    expect(info.beatTime).toBe(0.0)
  })

  // --- Multiple timing points ---
  it('uses second point for time within second segment', () => {
    const points: TimingPoint[] = [
      tp({ id: 'p1', time: 0, bpm: 120 }),
      tp({ id: 'p2', time: 10, bpm: 60 }),
    ]
    // p2: beat duration = 60/60 = 1.0s
    const info = getBeatInfoAtTime(points, 12)
    expect(info.pointId).toBe('p2')
    expect(info.beatIndex).toBe(2) // (12 - 10) / 1.0 = 2
    expect(info.beatTime).toBe(12)
  })

  it('resets beatIndex and barIndex at segment boundary', () => {
    const points: TimingPoint[] = [
      tp({ id: 'p1', time: 0, bpm: 120 }),
      tp({ id: 'p2', time: 8, bpm: 120 }),
    ]
    // p1: beat 0,1,2,...,15 at times 0,0.5,...,7.5
    // p2 starts at time=8, beat 0
    const info = getBeatInfoAtTime(points, 8)
    expect(info.pointId).toBe('p2')
    expect(info.beatIndex).toBe(0)
    expect(info.barIndex).toBe(0)
    expect(info.isBarStart).toBe(true)
    expect(info.beatTime).toBe(8)
  })

  // --- Exact boundary ---
  it('time exactly at second point start uses second point', () => {
    const points: TimingPoint[] = [
      tp({ id: 'p1', time: 0, bpm: 120 }),
      tp({ id: 'p2', time: 10, bpm: 120 }),
    ]
    const info = getBeatInfoAtTime(points, 10)
    expect(info.pointId).toBe('p2')
  })
})

// ============================================================
// getNextBeatTime
// ============================================================
describe('getNextBeatTime', () => {
  it('returns the next beat boundary strictly after given time', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    // beat duration = 0.5s
    // at time 0.3, current beat is 0 (0.0), next beat = 0.5
    expect(getNextBeatTime(points, 0.3)).toBe(0.5)
  })

  it('returns next beat when time is exactly on beat boundary', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    expect(getNextBeatTime(points, 0.0)).toBe(0.5)
    expect(getNextBeatTime(points, 0.5)).toBe(1.0)
  })

  it('handles backward projection correctly', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 10, bpm: 120 })]
    // beat duration = 0.5s
    // time 9.5 → beat -1 at 9.5, next beat = 10.0
    expect(getNextBeatTime(points, 9.5)).toBe(10.0)
  })

  it('crosses segment boundary to next timing point', () => {
    const points: TimingPoint[] = [
      tp({ id: 'p1', time: 0, bpm: 120 }),
      tp({ id: 'p2', time: 8, bpm: 120 }),
    ]
    // p1: beats at 0, 0.5, 1.0, ..., 7.5
    // at time 7.6, next beat would be 8.0 which is p2's start
    expect(getNextBeatTime(points, 7.6)).toBe(8.0)
  })

  it('returns next beat within last segment normally', () => {
    const points: TimingPoint[] = [
      tp({ id: 'p1', time: 0, bpm: 120 }),
      tp({ id: 'p2', time: 10, bpm: 60 }),
    ]
    // p2: beat duration = 1.0s, at time 11.5, beat 1 at 11.0, next = 12.0
    expect(getNextBeatTime(points, 11.5)).toBe(12.0)
  })

  it('returns next beat for time just after a beat boundary', () => {
    const points: TimingPoint[] = [tp({ id: 'tp-1', time: 0, bpm: 120 })]
    // time 0.001 is just after beat 0, next beat = 0.5
    expect(getNextBeatTime(points, 0.001)).toBe(0.5)
  })
})

// ============================================================
// getPreviousBarTime
// ============================================================
describe('getPreviousBarTime', () => {
  const points = [
    tp({
      id: '1',
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    }),
  ]

  it('returns time of previous bar boundary when in the middle of a bar', () => {
    // At time 3s (beat 6 in 4/4 at 120bpm, bar 1), previous bar starts at beat 4 = 2s
    const prev = getPreviousBarTime(points, 3)
    expect(prev).toBeCloseTo(2, 5)
  })

  it('returns time of previous bar when exactly on a bar boundary', () => {
    // At time 2s (beat 4 = bar 1 start), previous bar starts at beat 0 = 0s
    const prev = getPreviousBarTime(points, 2)
    expect(prev).toBeCloseTo(0, 5)
  })

  it('returns time of previous bar when at the very beginning', () => {
    // At time 0s (beat 0), previous bar would be negative
    const prev = getPreviousBarTime(points, 0)
    expect(prev).toBeCloseTo(-2, 5) // one bar back = -4 beats at 0.5s = -2s
  })

  it('uses point.time directly without offset adjustment', () => {
    const prev = getPreviousBarTime(points, 2.4)
    expect(prev).toBeCloseTo(2, 5)
  })

  it('crosses segment boundary backward to previous timing point', () => {
    // p1: 120bpm, barDur=2.0s → bars at 0, 2, 4, 6
    // p2: 240bpm, barDur=1.0s → bars at 8, 9, 10, 11, ...
    const twoPoints = [
      tp({
        id: 'p1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
      tp({
        id: 'p2',
        time: 8,
        bpm: 240,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
    ]
    // At time=8 (exactly on the segment boundary), active point is p2.
    // getBeatInfoAtTime gives beatIdx=0, isBarStart=true.
    // prevBarStartBeat = -4, prevBarTime = 8 + (-4)*0.25 = 7.0 (WRONG).
    // The correct previous bar is from p1: beat 12 at time 6.0.
    const prev = getPreviousBarTime(twoPoints, 8)
    expect(prev).toBeCloseTo(6, 5)
  })
})

// ============================================================
// getNextBarBoundaryTime
// ============================================================
describe('getNextBarBoundaryTime', () => {
  const points = [
    tp({
      id: '1',
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    }),
  ]

  it('returns time of next bar boundary', () => {
    // At time 1s (beat 2 in 4/4), next bar starts at beat 4 = 2s
    const next = getNextBarBoundaryTime(points, 1)
    expect(next).toBeCloseTo(2, 5)
  })

  it('returns the next bar boundary when exactly on bar start', () => {
    // At time 2s (beat 4 = bar 1 start), next bar is bar 2 at beat 8 = 4s
    const next = getNextBarBoundaryTime(points, 2)
    expect(next).toBeCloseTo(4, 5)
  })

  it('returns the bar boundary after current position', () => {
    // At time 0, next bar boundary is at beat 4 = 2s
    const next = getNextBarBoundaryTime(points, 0)
    expect(next).toBeCloseTo(2, 5)
  })

  it('uses current beat position directly to compute next boundary', () => {
    const next = getNextBarBoundaryTime(points, 1.4)
    expect(next).toBeCloseTo(2, 5)
  })

  it('crosses segment boundary to next timing point', () => {
    const twoPoints = [
      tp({
        id: 'p1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
      tp({
        id: 'p2',
        time: 3,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
    ]
    // p1: bars at 0s, 2s, 4s, ...
    // At time 2.5, next bar in p1 would be at 4.0 which is past p2's start at 3.0
    // → should return p2's start at 3.0
    expect(getNextBarBoundaryTime(twoPoints, 2.5)).toBeCloseTo(3.0, 5)
  })

  it('returns next bar within segment when boundary is before next point', () => {
    const twoPoints = [
      tp({
        id: 'p1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
      tp({
        id: 'p2',
        time: 8,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
    ]
    // At time 1.5, next bar = 2.0 which is well before p2 at 8.0
    expect(getNextBarBoundaryTime(twoPoints, 1.5)).toBeCloseTo(2.0, 5)
  })
})

// ============================================================
// getBeatGridLines
// ============================================================
describe('getBeatGridLines', () => {
  const BEAT_EPSILON = 1e-9

  it('returns empty array for empty timingPoints', () => {
    expect(getBeatGridLines([], 4, false, 0, 10)).toEqual([])
  })

  it('generates correct lines for 120bpm 4/4, divisor=1 (one per beat), 2 bars', () => {
    // 120bpm: beatDur=0.5s, bpBar=4, divisor=1 → 1 sub/beat → sub spacing=0.5s
    // Bar starts: 0.0, 2.0; beats: 0.5,1.0,1.5,2.5,3.0,3.5; no subdivisions
    const lines = getBeatGridLines(
      [tp({ id: 'p1', time: 0, bpm: 120 })],
      1,
      false,
      0,
      4,
    )
    const bars = lines.filter((l) => l.type === 'bar')
    const beats = lines.filter((l) => l.type === 'beat')
    const subs = lines.filter((l) => l.type === 'subdivision')
    expect(bars.map((l) => l.time)).toEqual([0, 2])
    expect(beats.map((l) => l.time)).toEqual([0.5, 1.0, 1.5, 2.5, 3.0, 3.5])
    expect(subs).toHaveLength(0)
  })

  it('generates subdivision lines for divisor=4', () => {
    // 120bpm: beatDur=0.5s, divisor=4 → subDur=0.125s
    // First beat (0→0.5): bar at 0, subdivisions at 0.125, 0.25, 0.375, beat at 0.5
    const lines = getBeatGridLines(
      [tp({ id: 'p1', time: 0, bpm: 120 })],
      4,
      false,
      0,
      0.5,
    )
    const times = lines.map((l) => l.time)
    expect(times).toHaveLength(4) // 0 (bar), 0.125, 0.25, 0.375
    expect(lines[0].type).toBe('bar')
    expect(lines[1].type).toBe('subdivision')
    expect(lines[2].type).toBe('subdivision')
    expect(lines[3].type).toBe('subdivision')
  })

  it('triplets mode divisor=2 gives 3 subs per beat', () => {
    // actualDivisor = round(2*3/2) = 3; beatDur=0.5, subDur=0.5/3≈0.1667
    // In one beat (0→0.5): bar at 0, subs at 0.1667, 0.3333
    const lines = getBeatGridLines(
      [tp({ id: 'p1', time: 0, bpm: 120 })],
      2,
      true,
      0,
      0.5,
    )
    expect(lines).toHaveLength(3) // bar=0, sub=0.1667, sub=0.3333
    expect(lines[0].type).toBe('bar')
    expect(lines[1].type).toBe('subdivision')
    expect(lines[2].type).toBe('subdivision')
    expect(lines[2].time).toBeCloseTo(1 / 3, 4)
  })

  it('divisor=1 triplets has no effect (actualDivisor stays 1)', () => {
    const normal = getBeatGridLines([tp({ id: 'p1' })], 1, false, 0, 4)
    const triplets = getBeatGridLines([tp({ id: 'p1' })], 1, true, 0, 4)
    expect(triplets).toEqual(normal)
  })

  it('returns lines sorted by time ascending', () => {
    const lines = getBeatGridLines([tp({ id: 'p1' })], 4, false, 0, 2)
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].time).toBeGreaterThanOrEqual(lines[i - 1].time)
    }
  })

  it('respects startSec and endSec window', () => {
    // Only lines within [1.0, 2.0] should appear
    const lines = getBeatGridLines([tp({ id: 'p1' })], 1, false, 1.0, 2.0)
    expect(
      lines.every((l) => l.time >= 1.0 - BEAT_EPSILON && l.time <= 2.0 + BEAT_EPSILON),
    ).toBe(true)
  })

  it('handles two timing point segments correctly', () => {
    // Segment 1: 0..4 at 120bpm, Segment 2: 4..∞ at 60bpm
    // beatDur1=0.5, beatDur2=1.0
    const lines = getBeatGridLines(
      [tp({ id: 'p1', time: 0, bpm: 120 }), tp({ id: 'p2', time: 4, bpm: 60 })],
      1,
      false,
      3.5,
      5.5,
    )
    // Should include lines from both segments in the window
    const times = lines.map((l) => l.time)
    expect(times.some((t) => t < 4)).toBe(true)
    expect(times.some((t) => t >= 4)).toBe(true)
  })
})

// ============================================================
// getNextSubdivisionTime
// ============================================================
describe('getNextSubdivisionTime', () => {
  it('returns next subdivision strictly after given time (divisor=4, 120bpm)', () => {
    // beatDur=0.5, subDur=0.5/4=0.125
    // at time 0.05: current sub=0 (0.0), next=0.125
    expect(getNextSubdivisionTime([tp({ id: 'p1' })], 0.05, 4, false)).toBeCloseTo(
      0.125,
      6,
    )
  })

  it('returns next sub when exactly on sub boundary', () => {
    expect(getNextSubdivisionTime([tp({ id: 'p1' })], 0.125, 4, false)).toBeCloseTo(
      0.25,
      6,
    )
  })

  it('triplets divisor=2 gives subDur=beatDur/3', () => {
    // beatDur=0.5, actualDivisor=3, subDur=0.5/3≈0.1667
    // at time 0.05: sub index=0, next=0.1667
    const t = getNextSubdivisionTime([tp({ id: 'p1' })], 0.05, 2, true)
    expect(t).toBeCloseTo(0.5 / 3, 4)
  })

  it('crosses segment boundary', () => {
    const points = [
      tp({ id: 'p1', time: 0, bpm: 120 }),
      tp({ id: 'p2', time: 2, bpm: 60 }),
    ]
    // p1 beatDur=0.5, divisor=1: next sub after 1.9 = 2.0 (boundary)
    expect(getNextSubdivisionTime(points, 1.9, 1, false)).toBeCloseTo(2.0, 6)
  })

  it('throws for empty timingPoints', () => {
    expect(() => getNextSubdivisionTime([], 0, 4, false)).toThrow()
  })
})

// ============================================================
// getPreviousSubdivisionTime
// ============================================================
describe('getPreviousSubdivisionTime', () => {
  it('returns current sub start when not on a boundary (divisor=4)', () => {
    // at 0.05: sub index=0, sub start=0.0
    expect(getPreviousSubdivisionTime([tp({ id: 'p1' })], 0.05, 4, false)).toBeCloseTo(
      0.0,
      6,
    )
  })

  it('returns previous sub when exactly on sub boundary', () => {
    // at 0.125: sub index=1, previous=0.0
    expect(getPreviousSubdivisionTime([tp({ id: 'p1' })], 0.125, 4, false)).toBeCloseTo(
      0.0,
      6,
    )
  })

  it('handles triplets', () => {
    // beatDur=0.5, actualDivisor=3, subDur=0.5/3
    // at time 0.5/3 (exactly on first sub): goes to 0.0
    const subDur = 0.5 / 3
    expect(getPreviousSubdivisionTime([tp({ id: 'p1' })], subDur, 2, true)).toBeCloseTo(
      0.0,
      4,
    )
  })

  it('throws for empty timingPoints', () => {
    expect(() => getPreviousSubdivisionTime([], 0, 4, false)).toThrow()
  })

  it('crosses segment boundary backward to previous timing point', () => {
    const twoPoints = [
      tp({
        id: 'p1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
      tp({
        id: 'p2',
        time: 4,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
    ]
    // p1: beatDur=0.5, divisor=2 → subDur=0.25
    // p2 starts at 4.0. At time 4.0 (boundary), active point is p2.
    // subIdx for p2: elapsed=0, subIdx=0, isExactlyOnSub: true
    // result = 4.0 + (-1)*0.25 = 3.75
    // 3.75 < 4.0 (point.time), cross-segment backward to p1:
    // At boundary: boundaryElapsed=(4.0-0.0)/0.25=16, boundarySubIdx=16
    // boundarySubStart=4.0, isBoundaryOnSub=true
    // → 0 + (16-1)*0.25 = 3.75
    expect(getPreviousSubdivisionTime(twoPoints, 4.0, 2, false)).toBeCloseTo(3.75, 5)
  })

  it('handles mid-segment lookup without cross-segment', () => {
    const twoPoints = [
      tp({
        id: 'p1',
        time: 5,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
      tp({
        id: 'p2',
        time: 10,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      }),
    ]
    // p1: divisor=2 → subDur=0.25
    // At time 5.1: subIdx=0, result=5.0 (>= point.time 5.0, no cross-segment)
    expect(getPreviousSubdivisionTime(twoPoints, 5.1, 2, false)).toBeCloseTo(5.0, 5)
  })
})

// ============================================================
// snapToNearestGridPoint
// ============================================================
describe('snapToNearestGridPoint', () => {
  const points: TimingPoint[] = [
    {
      id: 'tp-1',
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    },
  ]
  // 120 BPM, divisor 4 → subdivision = 0.125s (60/120/4)
  // Grid points: 0, 0.125, 0.25, 0.375, 0.5, ...

  it('snaps to nearest grid point (forward)', () => {
    const result = snapToNearestGridPoint(points, 0.06, 4, false)
    expect(result).toBeCloseTo(0.0, 6)
  })

  it('snaps to nearest grid point (backward)', () => {
    const result = snapToNearestGridPoint(points, 0.07, 4, false)
    expect(result).toBeCloseTo(0.125, 6)
  })

  it('snaps exactly on a grid point', () => {
    const result = snapToNearestGridPoint(points, 0.25, 4, false)
    expect(result).toBeCloseTo(0.25, 6)
  })

  it('works with triplets', () => {
    // divisor=4, triplets=true → actualDivisor = round(4*3/2) = 6
    // subdivision = 60/120/6 = 0.0833...
    const result = snapToNearestGridPoint(points, 0.04, 4, true)
    expect(result).toBeCloseTo(0.0, 6)
  })

  it('handles time before first timing point', () => {
    const result = snapToNearestGridPoint(points, -0.01, 4, false)
    expect(result).toBeCloseTo(0.0, 6)
  })

  it('throws on empty timing points', () => {
    expect(() => snapToNearestGridPoint([], 1.0, 4, false)).toThrow()
  })

  it('respects segment boundaries with multiple timing points', () => {
    const multiPoints: TimingPoint[] = [
      {
        id: 'tp-1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      },
      {
        id: 'tp-2',
        time: 1.0,
        bpm: 60,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      },
    ]
    const result = snapToNearestGridPoint(multiPoints, 0.99, 4, false)
    expect(result).toBeCloseTo(1.0, 6)
  })
})
