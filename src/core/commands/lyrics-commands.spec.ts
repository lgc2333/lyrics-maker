import { describe, expect, it } from 'vitest'

import type { LyricLine, ProjectDocument } from '../domain/project'
import { createEmptyProject } from '../domain/project'
import {
  createClearWordEndTimeCommand,
  createInsertLyricLinesAtCommand,
  createInsertLyricLinesCommand,
  createInsertWordCommand,
  createMergeWordsCommand,
  createRemoveLyricLineCommand,
  createRemoveWordCommand,
  createReplaceLineWordsCommand,
  createReplaceLyricsCommand,
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createSplitWordCommand,
  createUpdateWordTextCommand,
} from './lyrics-commands'

function projectWithLine(line: LyricLine): ProjectDocument {
  const p = createEmptyProject()
  return { ...p, lyrics: [line] }
}

describe('createSetLineStartTimeCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [{ id: 'w-1', text: 'hello' }],
  }

  it('sets startTime on the target line', () => {
    const cmd = createSetLineStartTimeCommand('line-1', 1.5)
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].startTime).toBe(1.5)
  })

  it('undo restores previous startTime', () => {
    const lineWithTime: LyricLine = { ...line, startTime: 0.5 }
    const cmd = createSetLineStartTimeCommand('line-1', 1.5)
    const after = cmd.do(projectWithLine(lineWithTime))
    expect(after.lyrics[0].startTime).toBe(1.5)
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].startTime).toBe(0.5)
  })

  it('undo restores undefined if line had no startTime', () => {
    const cmd = createSetLineStartTimeCommand('line-1', 1.5)
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].startTime).toBeUndefined()
  })

  it('returns state unchanged if lineId not found', () => {
    const cmd = createSetLineStartTimeCommand('nonexistent', 1.5)
    const state = projectWithLine(line)
    const after = cmd.do(state)
    expect(after.lyrics[0].startTime).toBeUndefined()
  })
})

describe('createSetWordEndTimeCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [
      { id: 'w-1', text: 'hello' },
      { id: 'w-2', text: 'world' },
    ],
    startTime: 0,
  }

  it('sets endTime on the target word', () => {
    const cmd = createSetWordEndTimeCommand('line-1', 'w-1', 1.0)
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words[0].endTime).toBe(1.0)
    expect(after.lyrics[0].words[1].endTime).toBeUndefined()
  })

  it('undo restores previous endTime', () => {
    const lineWithTimed: LyricLine = {
      ...line,
      words: [
        { id: 'w-1', text: 'hello', endTime: 0.5 },
        { id: 'w-2', text: 'world' },
      ],
    }
    const cmd = createSetWordEndTimeCommand('line-1', 'w-1', 1.0)
    const after = cmd.do(projectWithLine(lineWithTimed))
    expect(after.lyrics[0].words[0].endTime).toBe(1.0)
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words[0].endTime).toBe(0.5)
  })

  it('undo restores undefined if word had no endTime', () => {
    const cmd = createSetWordEndTimeCommand('line-1', 'w-1', 1.0)
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words[0].endTime).toBeUndefined()
  })

  it('does not mutate other words', () => {
    const cmd = createSetWordEndTimeCommand('line-1', 'w-1', 1.0)
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words[1]).toEqual({ id: 'w-2', text: 'world' })
  })
})

describe('createClearWordEndTimeCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [
      { id: 'w-1', text: 'hello', endTime: 1.0 },
      { id: 'w-2', text: 'world', endTime: 2.0 },
    ],
    startTime: 0,
  }

  it('clears endTime on the target word', () => {
    const cmd = createClearWordEndTimeCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words[0].endTime).toBeUndefined()
    expect(after.lyrics[0].words[1].endTime).toBe(2.0)
  })

  it('undo restores the cleared endTime', () => {
    const cmd = createClearWordEndTimeCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words[0].endTime).toBe(1.0)
  })

  it('do is a no-op if word already has no endTime', () => {
    const lineNoTime: LyricLine = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello' }],
    }
    const cmd = createClearWordEndTimeCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(lineNoTime))
    expect(after.lyrics[0].words[0].endTime).toBeUndefined()
  })
})

describe('createSplitWordCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [{ id: 'w-1', text: 'hello', endTime: 2.0 }],
    startTime: 0,
  }

  it('splits a word at charIndex into two words', () => {
    const cmd = createSplitWordCommand('line-1', 'w-1', 2, 'w-new')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words).toHaveLength(2)
    expect(after.lyrics[0].words[0]).toEqual({ id: 'w-1', text: 'he' })
    expect(after.lyrics[0].words[1]).toEqual({ id: 'w-new', text: 'llo', endTime: 2.0 })
  })

  it('undo merges the split words back', () => {
    const cmd = createSplitWordCommand('line-1', 'w-1', 2, 'w-new')
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words).toHaveLength(1)
    expect(undone.lyrics[0].words[0]).toEqual({
      id: 'w-1',
      text: 'hello',
      endTime: 2.0,
    })
  })

  it('uses String.prototype.slice semantics: charIndex=0 throws', () => {
    expect(() => createSplitWordCommand('line-1', 'w-1', 0, 'w-new')).toThrow()
  })

  it('uses String.prototype.slice semantics: charIndex=text.length throws on do()', () => {
    const cmd = createSplitWordCommand('line-1', 'w-1', 5, 'w-new')
    expect(() => cmd.do(projectWithLine(line))).toThrow()
  })

  it('front word loses endTime, back word inherits endTime', () => {
    const cmd = createSplitWordCommand('line-1', 'w-1', 3, 'w-new')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words[0].endTime).toBeUndefined()
    expect(after.lyrics[0].words[1].endTime).toBe(2.0)
  })

  it('preserves position among siblings', () => {
    const multiLine: LyricLine = {
      id: 'line-1',
      words: [
        { id: 'w-0', text: 'a', endTime: 0.5 },
        { id: 'w-1', text: 'hello', endTime: 2.0 },
        { id: 'w-2', text: 'b', endTime: 3.0 },
      ],
      startTime: 0,
    }
    const cmd = createSplitWordCommand('line-1', 'w-1', 2, 'w-new')
    const after = cmd.do(projectWithLine(multiLine))
    expect(after.lyrics[0].words.map((w) => w.id)).toEqual([
      'w-0',
      'w-1',
      'w-new',
      'w-2',
    ])
  })
})

describe('createMergeWordsCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [
      { id: 'w-1', text: 'hel', endTime: 1.0 },
      { id: 'w-2', text: 'lo', endTime: 2.0 },
    ],
    startTime: 0,
  }

  it('merges word with its next sibling, takes back endTime', () => {
    const cmd = createMergeWordsCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words).toHaveLength(1)
    expect(after.lyrics[0].words[0].id).toBe('w-1')
    expect(after.lyrics[0].words[0].text).toBe('hello')
    expect(after.lyrics[0].words[0].endTime).toBe(2.0)
  })

  it('undo splits them back', () => {
    const cmd = createMergeWordsCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words).toHaveLength(2)
    expect(undone.lyrics[0].words[0]).toEqual({ id: 'w-1', text: 'hel', endTime: 1.0 })
    expect(undone.lyrics[0].words[1]).toEqual({ id: 'w-2', text: 'lo', endTime: 2.0 })
  })

  it('throws when wordId is the last word (no next sibling)', () => {
    const singleLine: LyricLine = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello' }],
    }
    const cmd = createMergeWordsCommand('line-1', 'w-1')
    const state = projectWithLine(singleLine)
    expect(() => cmd.do(state)).toThrow()
  })

  it('preserves surrounding words', () => {
    const multiLine: LyricLine = {
      id: 'line-1',
      words: [
        { id: 'w-0', text: 'a', endTime: 0.5 },
        { id: 'w-1', text: 'hel', endTime: 1.0 },
        { id: 'w-2', text: 'lo', endTime: 2.0 },
        { id: 'w-3', text: 'b', endTime: 3.0 },
      ],
      startTime: 0,
    }
    const cmd = createMergeWordsCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(multiLine))
    expect(after.lyrics[0].words.map((w) => w.id)).toEqual(['w-0', 'w-1', 'w-3'])
    expect(after.lyrics[0].words[1].text).toBe('hello')
  })
})

describe('createInsertLyricLinesCommand', () => {
  it('appends lines to the end of lyrics', () => {
    const lines: LyricLine[] = [
      { id: 'line-1', words: [{ id: 'w-1', text: 'hello' }] },
      { id: 'line-2', words: [{ id: 'w-2', text: 'world' }] },
    ]
    const cmd = createInsertLyricLinesCommand(lines)
    const after = cmd.do(createEmptyProject())
    expect(after.lyrics).toHaveLength(2)
    expect(after.lyrics[0].id).toBe('line-1')
    expect(after.lyrics[1].id).toBe('line-2')
  })

  it('keeps the append command label', () => {
    const cmd = createInsertLyricLinesCommand([
      { id: 'line-1', words: [{ id: 'w-1', text: 'hello' }] },
    ])

    expect(cmd.label).toBe('lyrics.insertLines')
  })

  it('appends to existing lyrics', () => {
    const existing: LyricLine = {
      id: 'line-0',
      words: [{ id: 'w-0', text: 'existing' }],
    }
    const state = { ...createEmptyProject(), lyrics: [existing] }
    const newLines: LyricLine[] = [
      { id: 'line-1', words: [{ id: 'w-1', text: 'new' }] },
    ]
    const cmd = createInsertLyricLinesCommand(newLines)
    const after = cmd.do(state)
    expect(after.lyrics).toHaveLength(2)
    expect(after.lyrics[0].id).toBe('line-0')
    expect(after.lyrics[1].id).toBe('line-1')
  })

  it('undo removes the appended lines', () => {
    const lines: LyricLine[] = [{ id: 'line-1', words: [{ id: 'w-1', text: 'hello' }] }]
    const cmd = createInsertLyricLinesCommand(lines)
    const after = cmd.do(createEmptyProject())
    const undone = cmd.undo(after)
    expect(undone.lyrics).toHaveLength(0)
  })

  it('throws if any line has empty words array', () => {
    const lines: LyricLine[] = [{ id: 'line-1', words: [] }]
    expect(() => createInsertLyricLinesCommand(lines)).toThrow(
      'LyricLine words array must not be empty',
    )
  })
})

describe('createInsertLyricLinesAtCommand', () => {
  const existingLines: LyricLine[] = [
    { id: 'line-0', words: [{ id: 'w-0', text: 'first' }] },
    { id: 'line-3', words: [{ id: 'w-3', text: 'last' }] },
  ]

  const insertedLines: LyricLine[] = [
    { id: 'line-1', words: [{ id: 'w-1', text: 'hello' }] },
    { id: 'line-2', words: [{ id: 'w-2', text: 'world' }] },
  ]

  it('inserts lines at the requested middle index', () => {
    const state = { ...createEmptyProject(), lyrics: existingLines }
    const cmd = createInsertLyricLinesAtCommand(1, insertedLines)
    const after = cmd.do(state)

    expect(after.lyrics.map((line) => line.id)).toEqual([
      'line-0',
      'line-1',
      'line-2',
      'line-3',
    ])
  })

  it('uses the insert-at command label', () => {
    const cmd = createInsertLyricLinesAtCommand(1, insertedLines)

    expect(cmd.label).toBe('lyrics.insertLinesAt')
  })

  it('clamps a negative index to the top', () => {
    const state = { ...createEmptyProject(), lyrics: existingLines }
    const cmd = createInsertLyricLinesAtCommand(-5, insertedLines)
    const after = cmd.do(state)

    expect(after.lyrics.map((line) => line.id)).toEqual([
      'line-1',
      'line-2',
      'line-0',
      'line-3',
    ])
  })

  it('clamps an index past the end to the bottom', () => {
    const state = { ...createEmptyProject(), lyrics: existingLines }
    const cmd = createInsertLyricLinesAtCommand(99, insertedLines)
    const after = cmd.do(state)

    expect(after.lyrics.map((line) => line.id)).toEqual([
      'line-0',
      'line-3',
      'line-1',
      'line-2',
    ])
  })

  it('undo removes only the inserted line ids', () => {
    const state = { ...createEmptyProject(), lyrics: existingLines }
    const cmd = createInsertLyricLinesAtCommand(1, insertedLines)
    const after = cmd.do(state)
    const undone = cmd.undo(after)

    expect(undone.lyrics).toEqual(existingLines)
  })

  it('throws if any inserted line has an empty words array', () => {
    expect(() =>
      createInsertLyricLinesAtCommand(0, [{ id: 'line-empty', words: [] }]),
    ).toThrow('LyricLine words array must not be empty')
  })
})

describe('createRemoveLyricLineCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [{ id: 'w-1', text: 'hello', endTime: 1.0 }],
    startTime: 0.5,
  }

  it('removes the target line', () => {
    const cmd = createRemoveLyricLineCommand('line-1')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics).toHaveLength(0)
  })

  it('undo re-inserts the removed line at the same position', () => {
    const line2: LyricLine = { id: 'line-2', words: [{ id: 'w-2', text: 'world' }] }
    const state = { ...createEmptyProject(), lyrics: [line, line2] }
    const cmd = createRemoveLyricLineCommand('line-1')
    const after = cmd.do(state)
    expect(after.lyrics).toHaveLength(1)
    expect(after.lyrics[0].id).toBe('line-2')
    const undone = cmd.undo(after)
    expect(undone.lyrics).toHaveLength(2)
    expect(undone.lyrics[0].id).toBe('line-1')
    expect(undone.lyrics[0].startTime).toBe(0.5)
    expect(undone.lyrics[0].words[0].endTime).toBe(1.0)
  })

  it('returns state unchanged if lineId not found', () => {
    const cmd = createRemoveLyricLineCommand('nonexistent')
    const state = projectWithLine(line)
    const after = cmd.do(state)
    expect(after.lyrics).toHaveLength(1)
  })
})

describe('createUpdateWordTextCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [{ id: 'w1', text: 'hello' }],
  }

  it('updates word text', () => {
    const state = projectWithLine(line)
    const cmd = createUpdateWordTextCommand('line-1', 'w1', 'world')
    const result = cmd.do(state)
    expect(result.lyrics[0].words[0].text).toBe('world')
  })

  it('undoes word text update', () => {
    const state = projectWithLine(line)
    const cmd = createUpdateWordTextCommand('line-1', 'w1', 'world')
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words[0].text).toBe('hello')
  })

  it('returns state unchanged if lineId not found', () => {
    const state = projectWithLine(line)
    const cmd = createUpdateWordTextCommand('nonexistent', 'w1', 'world')
    const result = cmd.do(state)
    expect(result.lyrics[0].words[0].text).toBe('hello')
  })

  it('returns state unchanged if wordId not found', () => {
    const state = projectWithLine(line)
    const cmd = createUpdateWordTextCommand('line-1', 'nonexistent', 'world')
    const result = cmd.do(state)
    expect(result.lyrics[0].words[0].text).toBe('hello')
  })

  it('preserves other word properties (endTime)', () => {
    const lineWithTime: LyricLine = {
      id: 'line-1',
      words: [{ id: 'w1', text: 'hello', endTime: 2.5 }],
    }
    const state = projectWithLine(lineWithTime)
    const cmd = createUpdateWordTextCommand('line-1', 'w1', 'world')
    const result = cmd.do(state)
    expect(result.lyrics[0].words[0].endTime).toBe(2.5)
  })
})

describe('createInsertWordCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [
      { id: 'w1', text: 'hello' },
      { id: 'w2', text: 'world' },
    ],
  }

  it('inserts a word at the given index', () => {
    const state = projectWithLine(line)
    const cmd = createInsertWordCommand('line-1', 1, { id: 'w-new', text: 'big' })
    const result = cmd.do(state)
    expect(result.lyrics[0].words.map((w) => w.text)).toEqual(['hello', 'big', 'world'])
  })

  it('undoes word insertion', () => {
    const state = projectWithLine(line)
    const cmd = createInsertWordCommand('line-1', 1, { id: 'w-new', text: 'big' })
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words.map((w) => w.text)).toEqual(['hello', 'world'])
  })

  it('inserts at index 0 (prepend)', () => {
    const state = projectWithLine(line)
    const cmd = createInsertWordCommand('line-1', 0, { id: 'w-new', text: 'hey' })
    const result = cmd.do(state)
    expect(result.lyrics[0].words.map((w) => w.text)).toEqual(['hey', 'hello', 'world'])
  })

  it('inserts at end (append)', () => {
    const state = projectWithLine(line)
    const cmd = createInsertWordCommand('line-1', 2, { id: 'w-new', text: 'there' })
    const result = cmd.do(state)
    expect(result.lyrics[0].words.map((w) => w.text)).toEqual([
      'hello',
      'world',
      'there',
    ])
  })

  it('returns state unchanged if lineId not found', () => {
    const state = projectWithLine(line)
    const cmd = createInsertWordCommand('nonexistent', 0, { id: 'w-new', text: 'x' })
    const result = cmd.do(state)
    expect(result.lyrics[0].words).toHaveLength(2)
  })
})

describe('createReplaceLineWordsCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [{ id: 'w1', text: 'old', endTime: 1.0 }],
    startTime: 0,
  }

  it('replaces all words and clears timing', () => {
    const state = projectWithLine(line)
    const newWords = [
      { id: 'n1', text: 'new ' },
      { id: 'n2', text: 'text' },
    ]
    const cmd = createReplaceLineWordsCommand('line-1', newWords)
    const result = cmd.do(state)
    expect(result.lyrics[0].words).toEqual(newWords)
    expect(result.lyrics[0].startTime).toBeUndefined()
  })

  it('undoes word replacement restoring original words and timing', () => {
    const state = projectWithLine(line)
    const cmd = createReplaceLineWordsCommand('line-1', [{ id: 'n1', text: 'new' }])
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words[0].text).toBe('old')
    expect(restored.lyrics[0].words[0].endTime).toBe(1.0)
    expect(restored.lyrics[0].startTime).toBe(0)
  })

  it('returns state unchanged if lineId not found', () => {
    const state = projectWithLine(line)
    const cmd = createReplaceLineWordsCommand('nonexistent', [{ id: 'n1', text: 'x' }])
    const result = cmd.do(state)
    expect(result.lyrics[0].words[0].text).toBe('old')
  })

  it('undo is a no-op if do was never called', () => {
    const state = projectWithLine(line)
    const cmd = createReplaceLineWordsCommand('line-1', [{ id: 'n1', text: 'new' }])
    const result = cmd.undo(state)
    // Should return state unchanged (previousWords still null)
    expect(result.lyrics[0].words[0].text).toBe('old')
  })
})

describe('createReplaceLyricsCommand', () => {
  it('replaces every lyric line and undo restores the previous lyrics', () => {
    const state: ProjectDocument = {
      ...createEmptyProject(),
      lyrics: [
        {
          id: 'old-line',
          startTime: 1,
          words: [{ id: 'old-word', text: 'old', endTime: 2 }],
        },
      ],
    }
    const cmd = createReplaceLyricsCommand([
      {
        id: 'new-line',
        startTime: 3,
        words: [{ id: 'new-word', text: 'new', endTime: 4 }],
      },
    ])

    const next = cmd.do(state)
    expect(next.lyrics).toEqual([
      {
        id: 'new-line',
        startTime: 3,
        words: [{ id: 'new-word', text: 'new', endTime: 4 }],
      },
    ])
    expect(next.title).toBe(state.title)
    expect(next.timingPoints).toEqual(state.timingPoints)

    const undone = cmd.undo(next)
    expect(undone.lyrics).toEqual(state.lyrics)
  })

  it('rejects imported lyric lines without words', () => {
    expect(() => createReplaceLyricsCommand([{ id: 'line', words: [] }])).toThrow(
      'LyricLine words array must not be empty',
    )
  })
})

describe('createRemoveWordCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [
      { id: 'w1', text: 'hello' },
      { id: 'w2', text: 'world', endTime: 1.5 },
      { id: 'w3', text: 'big' },
    ],
  }

  it('removes the target word from the line', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('line-1', 'w2')
    const result = cmd.do(state)
    expect(result.lyrics[0].words.map((w) => w.id)).toEqual(['w1', 'w3'])
  })

  it('preserves other words unchanged', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('line-1', 'w2')
    const result = cmd.do(state)
    expect(result.lyrics[0].words[0]).toEqual({ id: 'w1', text: 'hello' })
    expect(result.lyrics[0].words[1]).toEqual({ id: 'w3', text: 'big' })
  })

  it('undo restores the removed word at its original index', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('line-1', 'w2')
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words.map((w) => w.id)).toEqual(['w1', 'w2', 'w3'])
    expect(restored.lyrics[0].words[1]).toEqual({
      id: 'w2',
      text: 'world',
      endTime: 1.5,
    })
  })

  it('undo restores word at first index (head)', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('line-1', 'w1')
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words.map((w) => w.id)).toEqual(['w1', 'w2', 'w3'])
  })

  it('undo restores word at last index (tail)', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('line-1', 'w3')
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words.map((w) => w.id)).toEqual(['w1', 'w2', 'w3'])
  })

  it('returns state unchanged if lineId not found', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('nonexistent', 'w1')
    const result = cmd.do(state)
    expect(result.lyrics[0].words).toHaveLength(3)
  })

  it('returns state unchanged if wordId not found', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('line-1', 'w-nonexistent')
    const result = cmd.do(state)
    expect(result.lyrics[0].words).toHaveLength(3)
  })

  it('undo is a no-op if do was never called', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('line-1', 'w2')
    const result = cmd.undo(state)
    expect(result.lyrics[0].words).toHaveLength(3)
  })

  it('do is idempotent (second do does not change state further)', () => {
    const state = projectWithLine(line)
    const cmd = createRemoveWordCommand('line-1', 'w2')
    const after1 = cmd.do(state)
    const after2 = cmd.do(after1)
    expect(after2.lyrics[0].words.map((w) => w.id)).toEqual(['w1', 'w3'])
  })
})
