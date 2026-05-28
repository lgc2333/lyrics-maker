import { describe, expect, it } from 'vitest'

import { createEmptyProject } from '../domain/project'
import { ttmlAdapter } from './ttml'

describe('ttmlAdapter', () => {
  it('imports AMLL TTML generated from the official serializer', () => {
    const source = ttmlAdapter.export({
      project: {
        ...createEmptyProject(),
        lyrics: [
          {
            id: 'l1',
            startTime: 1,
            words: [
              { id: 'w1', text: 'hello ', endTime: 2 },
              { id: 'w2', text: 'world', endTime: 3 },
            ],
          },
        ],
      },
    })

    const result = ttmlAdapter.parse(source)

    expect(result.lines).toEqual([
      {
        startTime: 1,
        words: [
          { text: 'hello ', endTime: 2 },
          { text: 'world', endTime: 3 },
        ],
      },
    ])
  })

  it('imports word spans and inserts placeholders for timing gaps', () => {
    const source = ttmlAdapter.export({
      project: {
        ...createEmptyProject(),
        lyrics: [
          {
            id: 'l1',
            startTime: 1,
            words: [
              { id: 'gap-start', text: '', endTime: 2 },
              { id: 'w1', text: 'hello', endTime: 3 },
              { id: 'gap-mid', text: '', endTime: 4 },
              { id: 'w2', text: 'world', endTime: 4.5 },
              { id: 'gap-end', text: '', endTime: 5 },
            ],
          },
        ],
      },
    })

    const result = ttmlAdapter.parse(source)

    expect(result.lines).toEqual([
      {
        startTime: 1,
        words: [
          { text: '', endTime: 2 },
          { text: 'hello', endTime: 3 },
          { text: '', endTime: 4 },
          { text: 'world', endTime: 4.5 },
          { text: '', endTime: 5 },
        ],
      },
    ])
  })

  it('exports AMLL TTML with escaped text and project metadata', () => {
    const text = ttmlAdapter.export({
      project: {
        ...createEmptyProject(),
        lyrics: [
          {
            id: 'l1',
            startTime: 1,
            words: [{ id: 'w1', text: 'a & b', endTime: 2 }],
          },
        ],
      },
    })

    expect(text).toContain('itunes:timing="Word"')
    expect(text).toContain('amll:meta key="musicName" value="Untitled Project"')
    expect(text).toContain('<p begin="1.000" end="2.000"')
    expect(text).toContain('<span begin="1.000" end="2.000">a &amp; b</span>')
  })
})
