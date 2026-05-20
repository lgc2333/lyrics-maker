import { describe, expect, it } from 'vitest'

import type { LyricLine, ProjectDocument } from '../domain/project'
import { createEmptyProject } from '../domain/project'
import {
  createClearWordEndTimeCommand,
  createMergeWordsCommand,
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createSplitWordCommand,
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
