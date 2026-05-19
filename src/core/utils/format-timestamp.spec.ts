import { describe, expect, it } from 'vitest'

import { formatTimestamp } from './format-timestamp'

describe('formatTimestamp', () => {
  it('formats zero as 00:00.000', () => {
    expect(formatTimestamp(0)).toBe('00:00.000')
  })

  it('formats seconds with milliseconds', () => {
    expect(formatTimestamp(1.234)).toBe('00:01.234')
  })

  it('formats minutes', () => {
    expect(formatTimestamp(65.5)).toBe('01:05.500')
  })

  it('handles large values', () => {
    expect(formatTimestamp(3661.001)).toBe('61:01.001')
  })

  it('returns 00:00.000 for NaN', () => {
    expect(formatTimestamp(Number.NaN)).toBe('00:00.000')
  })

  it('returns 00:00.000 for Infinity', () => {
    expect(formatTimestamp(Infinity)).toBe('00:00.000')
  })

  it('returns 00:00.000 for negative values', () => {
    expect(formatTimestamp(-1)).toBe('00:00.000')
  })

  it('rounds milliseconds correctly', () => {
    expect(formatTimestamp(8.029999)).toBe('00:08.030')
  })

  it('returns 00:00.000 for values above the practical cap', () => {
    expect(formatTimestamp(359999.999 + 1)).toBe('00:00.000')
  })

  it('returns 00:00.000 for extreme value Number.MAX_VALUE', () => {
    expect(formatTimestamp(Number.MAX_VALUE)).toBe('00:00.000')
  })

  it('returns valid format for value at the cap boundary', () => {
    // 359999.999 seconds ≈ 5999 minutes 59 seconds 999 ms
    expect(formatTimestamp(359999.999)).toBe('5999:59.999')
  })
})
