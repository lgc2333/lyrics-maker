import { describe, expect, it } from 'vitest'

import { createEmptyProject } from '../domain/project'
import { txtAdapter } from './txt'

describe('txtAdapter', () => {
  it('imports non-empty text lines as untimed auto-split words', () => {
    const result = txtAdapter.parse('hello world\n\nsecond line')

    expect(result.lines).toEqual([
      { words: [{ text: 'hello ' }, { text: 'world' }] },
      { words: [{ text: 'second ' }, { text: 'line' }] },
    ])
  })

  it('exports only lyric text', () => {
    const text = txtAdapter.export({
      project: {
        ...createEmptyProject(),
        lyrics: [
          {
            id: 'l1',
            words: [
              { id: 'w1', text: 'hello ' },
              { id: 'w2', text: 'world' },
            ],
          },
          {
            id: 'l2',
            words: [
              { id: 'w3', text: '' },
              { id: 'w4', text: 'again' },
            ],
          },
        ],
      },
    })

    expect(text).toBe('hello world\nagain')
  })
})
