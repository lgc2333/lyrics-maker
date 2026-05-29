import { describe, expect, it } from 'vitest'

import { createEmptyProject } from '../domain/project'
import {
  createAddLyricLineCommand,
  createAddTimingPointCommand,
  createRemoveTimingPointCommand,
  createSetProjectTitleCommand,
  createUpdateTimingPointCommand,
} from './project-commands'

function createProjectWithTimingPoint() {
  return {
    ...createEmptyProject(),
    timingPoints: [
      {
        id: 'tp-1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      },
    ],
  }
}

describe('add lyric line command', () => {
  it('adds a lyric line via do()', () => {
    const payload = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello world' }],
    }
    const command = createAddLyricLineCommand(payload)
    const afterDo = command.do(createEmptyProject())

    expect(afterDo.lyrics).toHaveLength(1)
    expect(afterDo.lyrics[0].id).toBe('line-1')
    expect(afterDo.lyrics[0].words).toEqual([{ id: 'w-1', text: 'hello world' }])
  })

  it('undo removes the added line', () => {
    const payload = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello world' }],
    }
    const command = createAddLyricLineCommand(payload)
    const afterDo = command.do(createEmptyProject())

    const afterUndo = command.undo(afterDo)
    expect(afterUndo.lyrics).toHaveLength(0)
  })

  it('do can be used as redo to re-add the line', () => {
    const payload = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello world' }],
    }
    const command = createAddLyricLineCommand(payload)
    const afterDo = command.do(createEmptyProject())

    const afterUndo = command.undo(afterDo)
    expect(afterUndo.lyrics).toHaveLength(0)

    const afterRedo = command.do(afterUndo)
    expect(afterRedo.lyrics).toHaveLength(1)
    expect(afterRedo.lyrics[0].id).toBe('line-1')
    expect(afterRedo.lyrics[0].words).toEqual([{ id: 'w-1', text: 'hello world' }])
  })

  it('do returns a new object and does not mutate input', () => {
    const payload = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello world' }],
    }
    const command = createAddLyricLineCommand(payload)
    const project = createEmptyProject()

    const afterDo = command.do(project)
    expect(afterDo).not.toBe(project)
    // Original project should remain unchanged
    expect(project.lyrics).toHaveLength(0)
    // The new state should have the added line
    expect(afterDo.lyrics).toHaveLength(1)
  })

  it('undo returns a new object and does not mutate input', () => {
    const payload = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello world' }],
    }
    const command = createAddLyricLineCommand(payload)
    const afterDo = command.do(createEmptyProject())

    const afterUndo = command.undo(afterDo)
    expect(afterUndo).not.toBe(afterDo)
    // afterDo should remain unchanged
    expect(afterDo.lyrics).toHaveLength(1)
    // afterUndo should have the line removed
    expect(afterUndo.lyrics).toHaveLength(0)
  })

  it('removes only the matching line when multiple lines exist', () => {
    const payload1 = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'first' }],
    }
    const payload2 = {
      id: 'line-2',
      words: [{ id: 'w-2', text: 'second' }],
    }
    const command1 = createAddLyricLineCommand(payload1)
    const command2 = createAddLyricLineCommand(payload2)

    const afterFirst = command1.do(createEmptyProject())
    const afterSecond = command2.do(afterFirst)

    expect(afterSecond.lyrics).toHaveLength(2)

    // Undo the second line only
    const afterUndo = command2.undo(afterSecond)
    expect(afterUndo.lyrics).toHaveLength(1)
    expect(afterUndo.lyrics[0].id).toBe('line-1')
  })

  it('throws when words array is empty', () => {
    expect(() => createAddLyricLineCommand({ id: 'line-1', words: [] })).toThrow(
      'LyricLine words array must not be empty',
    )
  })
})

describe('timing point commands', () => {
  it('adds and removes timing points via commands', () => {
    const payload = {
      id: 'tp-2',
      time: 12,
      bpm: 150,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    }
    const command = createAddTimingPointCommand(payload)
    const afterAdd = command.do(createEmptyProject())
    expect(afterAdd.timingPoints.some((p) => p.id === 'tp-2')).toBe(true)
    const afterUndo = command.undo(afterAdd)
    expect(afterUndo.timingPoints.some((p) => p.id === 'tp-2')).toBe(false)
  })

  it('updates a timing point via command', () => {
    const command = createUpdateTimingPointCommand('tp-1', { bpm: 140 })
    const afterUpdate = command.do(createProjectWithTimingPoint())
    expect(afterUpdate.timingPoints[0].bpm).toBe(140)
    expect(afterUpdate.timingPoints[0].time).toBe(0) // unchanged
    const afterUndo = command.undo(afterUpdate)
    expect(afterUndo.timingPoints[0].bpm).toBe(120)
  })

  it('removes a timing point via command', () => {
    const command = createRemoveTimingPointCommand('tp-1')
    const afterRemove = command.do(createProjectWithTimingPoint())
    expect(afterRemove.timingPoints).toHaveLength(0)
    const afterUndo = command.undo(afterRemove)
    expect(afterUndo.timingPoints).toHaveLength(1)
    expect(afterUndo.timingPoints[0].id).toBe('tp-1')
  })

  it('update command can be reused — undo restores to original state from first do()', () => {
    const project = createProjectWithTimingPoint()
    const command = createUpdateTimingPointCommand('tp-1', { bpm: 140 })

    // First do/undo cycle
    const afterFirst = command.do(project)
    expect(afterFirst.timingPoints[0].bpm).toBe(140)

    // Second do on the same project — should capture the same original state
    const afterSecond = command.do(project)
    expect(afterSecond.timingPoints[0].bpm).toBe(140)

    // Undo should restore to the original state captured in do()
    const undone = command.undo(afterSecond)
    expect(undone.timingPoints[0].bpm).toBe(120)
  })

  it('remove command undo is a no-op if do() was never called', () => {
    const command = createRemoveTimingPointCommand('tp-1')
    const project = createProjectWithTimingPoint()
    const result = command.undo(project)
    // Should return the project unchanged
    expect(result.timingPoints).toHaveLength(1)
    expect(result.timingPoints[0].id).toBe('tp-1')
  })
})

describe('project title command', () => {
  it('sets project title and is undoable', () => {
    const command = createSetProjectTitleCommand('New Title')
    const afterSet = command.do(createEmptyProject())

    expect(afterSet.title).toBe('New Title')

    const afterUndo = command.undo(afterSet)
    expect(afterUndo.title).toBe('Untitled Project')
  })

  it('trims blank titles back to the default title', () => {
    const command = createSetProjectTitleCommand('   ')
    const afterSet = command.do({ ...createEmptyProject(), title: 'Old Title' })

    expect(afterSet.title).toBe('Untitled Project')
  })
})
