import type { ProjectDocument, TimingPoint } from '../domain/project'
import type { Command } from './command'

export function createAddLyricLineCommand(payload: {
  id: string
  text: string
}): Command<ProjectDocument> {
  return {
    label: 'lyrics.addLine',
    do: (state) => ({
      ...state,
      lyrics: [...state.lyrics, { id: payload.id, text: payload.text, words: [] }],
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
  let originalPoint: TimingPoint | undefined
  return {
    label: 'timing.updatePoint',
    do: (state) => {
      originalPoint = state.timingPoints.find((p) => p.id === id)
      if (!originalPoint) return state
      return {
        ...state,
        timingPoints: state.timingPoints.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      }
    },
    undo: (state) => {
      if (!originalPoint) return state
      return {
        ...state,
        timingPoints: state.timingPoints.map((p) => (p.id === id ? originalPoint! : p)),
      }
    },
  }
}

export function createRemoveTimingPointCommand(id: string): Command<ProjectDocument> {
  let removed: TimingPoint | undefined
  return {
    label: 'timing.removePoint',
    do: (state) => {
      removed = state.timingPoints.find((p) => p.id === id)
      return {
        ...state,
        timingPoints: state.timingPoints.filter((p) => p.id !== id),
      }
    },
    undo: (state) => {
      if (!removed) return state
      return {
        ...state,
        timingPoints: [...state.timingPoints, removed],
      }
    },
  }
}

export function createSetRhythmModeCommand(
  mode: 'common' | 'triplets',
): Command<ProjectDocument> {
  let previous: 'common' | 'triplets' | undefined
  return {
    label: 'settings.setRhythmMode',
    do: (state) => {
      previous = state.settings.rhythmMode
      return { ...state, settings: { ...state.settings, rhythmMode: mode } }
    },
    undo: (state) => {
      if (previous === undefined) return state
      return { ...state, settings: { ...state.settings, rhythmMode: previous } }
    },
  }
}

export function createSetSnapDivisorCommand(
  divisor: 1 | 2 | 4 | 8 | 16,
): Command<ProjectDocument> {
  let previous: 1 | 2 | 4 | 8 | 16 | undefined
  return {
    label: 'settings.setSnapDivisor',
    do: (state) => {
      previous = state.settings.snapDivisor
      return { ...state, settings: { ...state.settings, snapDivisor: divisor } }
    },
    undo: (state) => {
      if (previous === undefined) return state
      return {
        ...state,
        settings: { ...state.settings, snapDivisor: previous },
      }
    },
  }
}

export function createSetAudioVolumeCommand(
  kind: 'music' | 'sfx',
  value: number,
): Command<ProjectDocument> {
  const key = kind === 'music' ? 'musicVolume' : 'sfxVolume'
  let previousValue: number | undefined
  return {
    label: `audio.set${kind === 'music' ? 'Music' : 'Sfx'}Volume`,
    do: (state) => {
      previousValue = state.audio[key]
      return {
        ...state,
        audio: { ...state.audio, [key]: value },
      }
    },
    undo: (state) => {
      if (previousValue === undefined) return state
      return {
        ...state,
        audio: { ...state.audio, [key]: previousValue },
      }
    },
  }
}
