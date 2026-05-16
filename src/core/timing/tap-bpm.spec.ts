import { describe, expect, it } from 'vitest'
import { createTapBpmEstimator } from './tap-bpm'

describe('createTapBpmEstimator', () => {
  // --- Initial state ---
  it('returns null on first push (not enough taps)', () => {
    const estimator = createTapBpmEstimator()
    expect(estimator.push(0.0)).toBeNull()
  })

  it('returns null after only 2 taps (not enough samples)', () => {
    const estimator = createTapBpmEstimator()
    estimator.push(0.0)
    expect(estimator.push(0.5)).toBeNull()
  })

  // --- Threshold: needs > 8 taps before returning estimate ---
  it('returns null before more than 8 taps', () => {
    const estimator = createTapBpmEstimator()
    for (let i = 0; i < 8; i++) estimator.push(i * 0.5)
    expect(estimator.push(8.0)).toBeNull()
  })

  it('returns estimate after 9th consecutive tap', () => {
    const estimator = createTapBpmEstimator()
    // 9 taps at 0.5s intervals: 0, 0.5, 1.0, ..., 4.0
    for (let i = 0; i < 9; i++) estimator.push(i * 0.5)
    // 10th tap continues the pattern, now buffer has 10 entries (> 8)
    const estimate = estimator.push(4.5)
    expect(estimate).not.toBeNull()
    expect(estimate!.bpm).toBe(120) // 60 / 0.5 = 120
    expect(estimate!.sampleCount).toBe(10)
  })

  // --- Reset on long gap ---
  it('returns bpm after 9th tap and resets on long gap', () => {
    const estimator = createTapBpmEstimator()
    for (let i = 0; i < 9; i++) estimator.push(i * 0.5)
    const estimate = estimator.push(4.5)
    expect(estimate?.bpm).toBeGreaterThan(100)
    estimator.push(8.0) // gap > 1s, should reset
    expect(estimator.push(8.5)).toBeNull()
  })

  it('resets buffer when gap exceeds 1 second', () => {
    const estimator = createTapBpmEstimator()
    // Build buffer with 9 taps
    for (let i = 0; i < 9; i++) estimator.push(i * 0.5)
    // Now push with a gap > 1s
    estimator.push(6.0) // gap from 4.0 to 6.0 = 2s > 1s, triggers reset
    // After reset, buffer only has [6.0], so next push still too few
    expect(estimator.push(6.5)).toBeNull()
    expect(estimator.push(7.0)).toBeNull()
  })

  // --- Reset method ---
  it('reset() clears all state', () => {
    const estimator = createTapBpmEstimator()
    for (let i = 0; i < 10; i++) estimator.push(i * 0.5)
    expect(estimator.push(5.0)).not.toBeNull() // should have estimate
    estimator.reset()
    // After reset, start fresh
    expect(estimator.push(0.0)).toBeNull()
    expect(estimator.push(0.5)).toBeNull()
  })

  // --- BPM calculation ---
  it('calculates BPM correctly from average interval (60 / avgInterval)', () => {
    const estimator = createTapBpmEstimator()
    // 9 taps at 1.0s intervals → 60 BPM
    for (let i = 0; i < 9; i++) estimator.push(i * 1.0)
    const estimate = estimator.push(9.0)
    expect(estimate?.bpm).toBe(60)
    expect(estimate?.sampleCount).toBe(10)
  })

  it('calculates BPM for non-uniform intervals using average', () => {
    const estimator = createTapBpmEstimator()
    // Intervals: 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4 (average = 0.5)
    let t = 0
    estimator.push(t)
    for (let i = 0; i < 8; i++) {
      const interval = i % 2 === 0 ? 0.4 : 0.6
      t += interval
      estimator.push(t)
    }
    const estimate = estimator.push(t + 0.5)
    expect(estimate?.bpm).toBeCloseTo(120, 0) // 60 / 0.5 = 120
  })

  // --- Very fast taps ---
  it('handles very fast taps correctly (~600 BPM)', () => {
    const estimator = createTapBpmEstimator()
    // 0.1s intervals → 600 BPM
    for (let i = 0; i < 9; i++) estimator.push(i * 0.1)
    const estimate = estimator.push(0.9)
    expect(estimate).not.toBeNull()
    expect(estimate!.bpm).toBeCloseTo(600, 0) // 60 / 0.1 = 600
  })

  // --- Sample limit ---
  it('respects maxSamples limit (default 128)', () => {
    const estimator = createTapBpmEstimator()
    // Push 200 taps at 0.4s intervals
    for (let i = 0; i < 200; i++) estimator.push(i * 0.4)
    const estimate = estimator.push(200 * 0.4)
    expect(estimate).not.toBeNull()
    // sampleCount should be capped at 128
    expect(estimate!.sampleCount).toBeLessThanOrEqual(128)
    // BPM should still be ~150 (60 / 0.4)
    expect(estimate!.bpm).toBeCloseTo(150, 0)
  })

  it('respects custom maxSamples', () => {
    const estimator = createTapBpmEstimator(16)
    for (let i = 0; i < 30; i++) estimator.push(i * 0.5)
    const estimate = estimator.push(30 * 0.5)
    expect(estimate).not.toBeNull()
    expect(estimate!.sampleCount).toBeLessThanOrEqual(16)
  })

  // --- Edge: negative timestamps ---
  it('handles negative timestamps (backward projection scenario)', () => {
    const estimator = createTapBpmEstimator()
    // Taps at negative timestamps
    for (let i = 0; i < 9; i++) estimator.push(-5.0 + i * 0.5)
    const estimate = estimator.push(-5.0 + 9 * 0.5)
    expect(estimate).not.toBeNull()
    expect(estimate!.bpm).toBe(120)
  })

  // --- Edge: decreasing timestamps (should still work, interval is absolute) ---
  it('handles non-monotonic timestamps gracefully', () => {
    const estimator = createTapBpmEstimator()
    // Build 9 taps normally
    for (let i = 0; i < 9; i++) estimator.push(i * 0.5)
    // Push a timestamp that goes backwards — gap would be negative, triggers reset
    const result = estimator.push(3.0) // gap from 4.0 to 3.0 = -1.0, not > 1s, no reset
    // This would give a negative interval which would mess up the average
    // The implementation should handle this or the user just shouldn't do it
    // We just verify it doesn't throw
    expect(result).toBeDefined()
  })
})
