import { describe, expect, it } from 'vitest'

import type { Command } from './command'
import { createCommandHistory } from './history'

describe('createCommandHistory', () => {
  it('undo is a no-op on an empty stack', () => {
    const history = createCommandHistory(0)

    history.undo()

    expect(history.state).toBe(0)
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('redo is a no-op on an empty stack', () => {
    const history = createCommandHistory(0)

    history.redo()

    expect(history.state).toBe(0)
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('executes, undoes, and redoes commands', () => {
    const addOne: Command<number> = {
      label: 'add one',
      do: (state) => state + 1,
      undo: (state) => state - 1,
    }

    const history = createCommandHistory(0)

    history.execute(addOne)
    expect(history.state).toBe(1)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)

    history.undo()
    expect(history.state).toBe(0)
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)

    history.redo()
    expect(history.state).toBe(1)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('clears redo history after a new execute', () => {
    const addOne: Command<number> = {
      label: 'add one',
      do: (state) => state + 1,
      undo: (state) => state - 1,
    }

    const addTwo: Command<number> = {
      label: 'add two',
      do: (state) => state + 2,
      undo: (state) => state - 2,
    }

    const history = createCommandHistory(0)

    history.execute(addOne)
    history.undo()
    expect(history.canRedo).toBe(true)

    history.execute(addTwo)
    expect(history.state).toBe(2)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('keeps undo history when undo throws', () => {
    const history = createCommandHistory(1)
    const command: Command<number> = {
      label: 'throwing undo',
      do: (state) => state + 1,
      undo: () => {
        throw new Error('undo failed')
      },
    }

    history.execute(command)

    expect(() => history.undo()).toThrow('undo failed')
    expect(history.state).toBe(2)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('keeps redo history when redo throws', () => {
    const history = createCommandHistory(0)
    let shouldThrowOnRedo = false
    const command: Command<number> = {
      label: 'throwing redo',
      do: (state) => {
        if (shouldThrowOnRedo) {
          throw new Error('redo failed')
        }

        shouldThrowOnRedo = true

        return state + 1
      },
      undo: (state) => state - 1,
    }

    history.execute(command)
    history.undo()

    expect(() => history.redo()).toThrow('redo failed')
    expect(history.state).toBe(0)
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)
  })

  it('protects array state from external mutation', () => {
    const initialArray = [1, 2, 3]
    const history = createCommandHistory(initialArray)

    const retrievedState = history.state as number[]
    retrievedState[0] = 999
    retrievedState.push(4)

    // Internal state should remain unchanged
    expect(history.state).toEqual([1, 2, 3])
  })

  it('protects object state from external mutation', () => {
    const initialObject = { count: 0, name: 'test' }
    const history = createCommandHistory(initialObject)

    const retrievedState = history.state as typeof initialObject
    retrievedState.count = 999
    retrievedState.name = 'mutated'

    // Internal state should remain unchanged
    expect(history.state).toEqual({ count: 0, name: 'test' })
  })

  it('returns primitives safely without creating copies', () => {
    const history = createCommandHistory(42)

    const state1 = history.state
    const state2 = history.state

    expect(state1).toBe(42)
    expect(state2).toBe(42)
    expect(state1).toBe(state2) // primitives are identical
  })
})
