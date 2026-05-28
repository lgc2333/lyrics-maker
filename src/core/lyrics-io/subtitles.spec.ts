import { describe, expect, it } from 'vitest'

import { createEmptyProject } from '../domain/project'
import { assAdapter, srtAdapter, vttAdapter } from './subtitles'

describe('subtitle adapters', () => {
  it('imports and exports SRT cues', () => {
    const result = srtAdapter.parse('1\n00:00:01,000 --> 00:00:03,000\nhello world\n')
    expect(result.lines).toEqual([
      {
        startTime: 1,
        words: [{ text: 'hello ' }, { text: 'world', endTime: 3 }],
      },
    ])

    expect(
      srtAdapter.export({
        project: {
          ...createEmptyProject(),
          lyrics: result.lines.map((line, lineIndex) => ({
            id: `l${lineIndex}`,
            startTime: line.startTime,
            words: line.words.map((word, wordIndex) => ({
              id: `w${wordIndex}`,
              ...word,
            })),
          })),
        },
      }),
    ).toContain('00:00:01,000 --> 00:00:03,000')
  })

  it('imports and exports VTT cues', () => {
    const result = vttAdapter.parse(
      'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nhello world\n',
    )
    expect(result.lines[0].startTime).toBe(1)
    expect(result.lines[0].words.at(-1)?.endTime).toBe(3)
    expect(
      vttAdapter.export({
        project: {
          ...createEmptyProject(),
          lyrics: [
            {
              id: 'l1',
              startTime: 1,
              words: [{ id: 'w1', text: 'hello', endTime: 3 }],
            },
          ],
        },
      }),
    ).toContain('WEBVTT')
  })

  it('imports and exports ASS dialogue lines', () => {
    const result = assAdapter.parse(
      '[Script Info]\nTitle: Demo\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\i1}hello world\n',
    )

    expect(result.lines).toEqual([
      {
        startTime: 1,
        words: [{ text: 'hello ' }, { text: 'world', endTime: 3 }],
      },
    ])
    expect(
      assAdapter.export({
        project: {
          ...createEmptyProject(),
          lyrics: [
            {
              id: 'l1',
              startTime: 1,
              words: [{ id: 'w1', text: 'hello', endTime: 3 }],
            },
          ],
        },
      }),
    ).toContain('Dialogue: 0,0:00:01.00,0:00:03.00')
  })

  it('imports ASS karaoke tags as word timing', () => {
    const result = assAdapter.parse(
      '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:05.96,0:00:08.12,Default,,0,0,0,,{\\k48}Dance {\\k23}With {\\k23}The {\\k122}Devil\n',
    )

    expect(result.lines).toEqual([
      {
        startTime: 5.96,
        words: [
          { text: 'Dance ', endTime: 6.44 },
          { text: 'With ', endTime: 6.67 },
          { text: 'The ', endTime: 6.9 },
          { text: 'Devil', endTime: 8.12 },
        ],
      },
    ])
  })

  it('exports ASS word timing with karaoke tags', () => {
    const text = assAdapter.export({
      project: {
        ...createEmptyProject(),
        lyrics: [
          {
            id: 'l1',
            startTime: 1,
            words: [
              { id: 'w1', text: 'hello ', endTime: 1.5 },
              { id: 'w2', text: 'world', endTime: 2.25 },
            ],
          },
        ],
      },
    })

    expect(text).toContain(
      'Dialogue: 0,0:00:01.00,0:00:02.25,Default,,0000,0000,0000,,{\\k50}hello {\\k75}world',
    )
  })
})
