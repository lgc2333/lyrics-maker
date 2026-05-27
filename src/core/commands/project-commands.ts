import type { LyricWord, ProjectDocument, TimingPoint } from '../domain/project'
import { createEmptyProject } from '../domain/project'
import { validateTimingPoint } from '../timing/timing-point'
import type { Command } from './command'

export function createAddLyricLineCommand(payload: {
  id: string
  words: LyricWord[]
}): Command<ProjectDocument> {
  if (payload.words.length === 0) {
    throw new Error('LyricLine words array must not be empty')
  }
  return {
    label: 'lyrics.addLine',
    do: (state) => ({
      ...state,
      lyrics: [...state.lyrics, { id: payload.id, words: payload.words }],
    }),
    undo: (state) => ({
      ...state,
      lyrics: state.lyrics.filter((line) => line.id !== payload.id),
    }),
  }
}

export function createAddTimingPointCommand(
  payload: TimingPoint,
): Command<ProjectDocument> {
  const errors = validateTimingPoint(payload)
  if (errors.length > 0) {
    throw new Error(errors.join('; '))
  }
  return {
    label: 'timing.addPoint',
    do: (state) => ({
      ...state,
      timingPoints: [...state.timingPoints, payload],
    }),
    undo: (state) => ({
      ...state,
      timingPoints: state.timingPoints.filter((p) => p.id !== payload.id),
    }),
  }
}

export function createUpdateTimingPointCommand(
  id: string,
  patch: Partial<TimingPoint>,
): Command<ProjectDocument> {
  const errors = validateTimingPoint(patch)
  if (errors.length > 0) {
    throw new Error(errors.join('; '))
  }
  let originalPoint: TimingPoint | null = null
  return {
    label: 'timing.updatePoint',
    do: (state) => {
      const found = state.timingPoints.find((p) => p.id === id)
      if (!found) return state
      originalPoint = found
      return {
        ...state,
        timingPoints: state.timingPoints.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      }
    },
    undo: (state) => {
      if (originalPoint === null) return state
      return {
        ...state,
        timingPoints: state.timingPoints.map((p) => (p.id === id ? originalPoint! : p)),
      }
    },
  }
}

export function createRemoveTimingPointCommand(id: string): Command<ProjectDocument> {
  let removed: TimingPoint | null = null
  return {
    label: 'timing.removePoint',
    do: (state) => {
      const found = state.timingPoints.find((p) => p.id === id)
      removed = found ?? null
      return {
        ...state,
        timingPoints: state.timingPoints.filter((p) => p.id !== id),
      }
    },
    undo: (state) => {
      if (removed === null) return state
      return {
        ...state,
        timingPoints: [...state.timingPoints, removed],
      }
    },
  }
}

export function createSetProjectTitleCommand(title: string): Command<ProjectDocument> {
  let previousTitle: string | null = null
  return {
    label: 'project.setTitle',
    do: (state) => {
      previousTitle = state.title
      const nextTitle = title.trim() || createEmptyProject().title
      return { ...state, title: nextTitle }
    },
    undo: (state) => {
      if (previousTitle === null) return state
      return { ...state, title: previousTitle }
    },
  }
}
