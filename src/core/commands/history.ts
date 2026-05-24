import type { Command } from './command'

export interface CommandHistory<TState> {
  readonly state: TState
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly nextUndoLabel: string | null
  readonly nextRedoLabel: string | null
  execute: (command: Command<TState>) => void
  undo: () => void
  redo: () => void
}

function createSnapshot<T>(value: T): T {
  // For primitives, return as-is (safe from mutation)
  if (value === null || typeof value !== 'object') {
    return value
  }

  // Deep clone to protect against mutations of nested objects/arrays
  return structuredClone(value) as T
}

export function createCommandHistory<TState>(
  initialState: TState,
): CommandHistory<TState> {
  let state = initialState
  const undoStack: Command<TState>[] = []
  const redoStack: Command<TState>[] = []

  return {
    get state() {
      return createSnapshot(state)
    },
    get canUndo() {
      return undoStack.length > 0
    },
    get canRedo() {
      return redoStack.length > 0
    },
    get nextUndoLabel() {
      return undoStack[undoStack.length - 1]?.label ?? null
    },
    get nextRedoLabel() {
      return redoStack[redoStack.length - 1]?.label ?? null
    },
    execute(command) {
      const newState = command.do(state)
      // Only update stacks after successful command execution
      undoStack.push(command)
      redoStack.length = 0
      state = newState
    },
    undo() {
      const command = undoStack[undoStack.length - 1]

      if (!command) {
        return
      }

      const newState = command.undo(state)
      // Only update stacks after successful undo
      undoStack.pop()
      redoStack.push(command)
      state = newState
    },
    redo() {
      const command = redoStack[redoStack.length - 1]

      if (!command) {
        return
      }

      const newState = command.do(state)
      // Only update stacks after successful redo
      redoStack.pop()
      undoStack.push(command)
      state = newState
    },
  }
}
