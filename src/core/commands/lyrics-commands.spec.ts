import { describe, expect, it } from 'vitest'

import type { LyricLine, ProjectDocument } from '../domain/project'
import { createEmptyProject } from '../domain/project'
import {
  createClearWordEndTimeCommand,
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
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
