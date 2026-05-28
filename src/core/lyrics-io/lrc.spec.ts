import { describe, expect, it } from 'vitest'

import { createEmptyProject } from '../domain/project'
import { lrcAdapter } from './lrc'

describe('lrcAdapter', () => {
  it('imports ordinary line-level LRC', () => {
    const result = lrcAdapter.parse('[00:12.000]hello world')

    expect(result.lines).toEqual([
      {
        startTime: 12,
        words: [{ text: 'hello ' }, { text: 'world' }],
      },
    ])
  })

  it('imports angle-bracket word LRC without auto-splitting timed segments', () => {
    const result = lrcAdapter.parse('[00:12.000]<00:12.000>你<00:12.300>好 world', {
      audioDuration: 20,
    })

    expect(result.lines).toEqual([
      {
        startTime: 12,
        words: [
          { text: '你', endTime: 12.3 },
          { text: '好 world', endTime: 20 },
        ],
      },
    ])
  })

  it('imports compatible square-bracket word LRC', () => {
    const result = lrcAdapter.parse('[00:12.000]你[00:12.300]好', {
      audioDuration: 13,
    })

    expect(result.lines).toEqual([
      {
        startTime: 12,
        words: [
          { text: '你', endTime: 12.3 },
          { text: '好', endTime: 13 },
        ],
      },
    ])
  })

  it('uses next line start before audio duration for the final word segment end', () => {
    const result = lrcAdapter.parse('[00:12.000]<00:12.000>one\n[00:15.000]two', {
      audioDuration: 20,
    })

    expect(result.lines[0].words[0].endTime).toBe(15)
  })

  it('falls back to segment start plus one second without next line or audio duration', () => {
    const result = lrcAdapter.parse('[00:12.000]<00:12.250>one')

    expect(result.lines[0].words[0].endTime).toBe(13.25)
  })

  it('uses an ordinary empty LRC timestamp line as the previous line end', () => {
    const result = lrcAdapter.parse('[00:12.000]你好\n[00:13.000]\n[00:14.000]next')

    expect(result.lines).toEqual([
      {
        startTime: 12,
        words: [{ text: '你好', endTime: 13 }],
      },
      {
        startTime: 14,
        words: [{ text: 'next' }],
      },
    ])
  })

  it('ignores empty LRC timestamp lines when no previous lyric can receive them', () => {
    const result = lrcAdapter.parse('[00:12.000]\n[00:13.000]hello')

    expect(result.lines).toEqual([
      {
        startTime: 13,
        words: [{ text: 'hello' }],
      },
    ])
  })

  it('imports enhanced LRC trailing angle timestamp as line end without an empty word', () => {
    const result = lrcAdapter.parse('[00:12.000]<00:12.000>你<00:12.300>好<00:13.000>')

    expect(result.lines).toEqual([
      {
        startTime: 12,
        words: [
          { text: '你', endTime: 12.3 },
          { text: '好', endTime: 13 },
        ],
      },
    ])
  })

  it('imports ESLyric trailing square timestamp as line end without an empty word', () => {
    const result = lrcAdapter.parse('[00:12.000]你[00:12.300]好[00:13.000]')

    expect(result.lines).toEqual([
      {
        startTime: 12,
        words: [
          { text: '你', endTime: 12.3 },
          { text: '好', endTime: 13 },
        ],
      },
    ])
  })

  it('uses an empty timestamp line as enhanced LRC final word end', () => {
    const result = lrcAdapter.parse('[00:12.000]<00:12.000>one\n[00:13.500]')

    expect(result.lines).toEqual([
      {
        startTime: 12,
        words: [{ text: 'one', endTime: 13.5 }],
      },
    ])
  })

  it('uses an empty timestamp line as ESLyric final word end', () => {
    const result = lrcAdapter.parse('[00:12.000]你[00:12.300]好\n[00:13.500]')

    expect(result.lines).toEqual([
      {
        startTime: 12,
        words: [
          { text: '你', endTime: 12.3 },
          { text: '好', endTime: 13.5 },
        ],
      },
    ])
  })

  it('exports angle-bracket word LRC by default when word timing is complete', () => {
    const text = lrcAdapter.export({
      project: {
        ...createEmptyProject(),
        lyrics: [
          {
            id: 'l1',
            startTime: 12,
            words: [
              { id: 'w1', text: '你', endTime: 12.3 },
              { id: 'w2', text: '好', endTime: 13 },
            ],
          },
        ],
      },
    })

    expect(text).toBe('[00:12.000]<00:12.000>你<00:12.300>好<00:13.000>')
  })

  it('exports line-level LRC with an empty end timestamp line', () => {
    const text = lrcAdapter.export(
      {
        project: {
          ...createEmptyProject(),
          lyrics: [
            {
              id: 'l1',
              startTime: 12,
              words: [
                { id: 'w1', text: '你' },
                { id: 'w2', text: '好', endTime: 13 },
              ],
            },
          ],
        },
      },
      { lrcWordTiming: 'line' },
    )

    expect(text).toBe('[00:12.000]你好\n[00:13.000]')
  })

  it('exports ESLyric with trailing square end timestamp', () => {
    const text = lrcAdapter.export(
      {
        project: {
          ...createEmptyProject(),
          lyrics: [
            {
              id: 'l1',
              startTime: 12,
              words: [
                { id: 'w1', text: '你', endTime: 12.3 },
                { id: 'w2', text: '好', endTime: 13 },
              ],
            },
          ],
        },
      },
      { lrcWordTiming: 'square' },
    )

    expect(text).toBe('[00:12.000][00:12.000]你[00:12.300]好[00:13.000]')
  })
})
