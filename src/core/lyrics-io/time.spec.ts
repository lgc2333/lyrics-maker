import { describe, expect, it } from 'vitest'

import {
  formatAssTime,
  formatLrcTime,
  formatSubtitleTime,
  formatTtmlTime,
  parseAssTime,
  parseLrcTime,
  parseSubtitleTime,
  parseTtmlTime,
} from './time'

describe('lyrics-io time helpers', () => {
  it('parses and formats LRC timestamps', () => {
    expect(parseLrcTime('01:02.34')).toBeCloseTo(62.34, 6)
    expect(parseLrcTime('01:02.345')).toBeCloseTo(62.345, 6)
    expect(formatLrcTime(62.345)).toBe('[01:02.345]')
  })

  it('parses and formats subtitle timestamps', () => {
    expect(parseSubtitleTime('00:01:02,345')).toBeCloseTo(62.345, 6)
    expect(parseSubtitleTime('00:01:02.345')).toBeCloseTo(62.345, 6)
    expect(formatSubtitleTime(62.345, ',')).toBe('00:01:02,345')
    expect(formatSubtitleTime(62.345, '.')).toBe('00:01:02.345')
  })

  it('parses and formats ASS centisecond timestamps', () => {
    expect(parseAssTime('0:01:02.34')).toBeCloseTo(62.34, 6)
    expect(formatAssTime(62.345)).toBe('0:01:02.35')
  })

  it('parses TTML clock and offset timestamps', () => {
    expect(parseTtmlTime('00:01:02.345')).toBeCloseTo(62.345, 6)
    expect(parseTtmlTime('62.345s')).toBeCloseTo(62.345, 6)
    expect(parseTtmlTime('62345ms')).toBeCloseTo(62.345, 6)
    expect(formatTtmlTime(62.345)).toBe('00:01:02.345')
  })
})
