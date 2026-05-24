import type { LyricWord, ProjectDocument, TimingPoint } from '../domain/project'
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

export function createSetRhythmModeCommand(
  mode: 'common' | 'triplets',
): Command<ProjectDocument> {
  let previousMode: 'common' | 'triplets' | null = null
  return {
    label: 'settings.setRhythmMode',
    do: (state) => {
      previousMode = state.settings.rhythmMode
      return { ...state, settings: { ...state.settings, rhythmMode: mode } }
    },
    undo: (state) => {
      if (previousMode === null) return state
      return { ...state, settings: { ...state.settings, rhythmMode: previousMode } }
    },
  }
}

export function createSetSnapDivisorCommand(
  divisor: 1 | 2 | 4 | 8 | 16,
): Command<ProjectDocument> {
  let previousDivisor: 1 | 2 | 4 | 8 | 16 | null = null
  return {
    label: 'settings.setSnapDivisor',
    do: (state) => {
      previousDivisor = state.settings.snapDivisor
      return { ...state, settings: { ...state.settings, snapDivisor: divisor } }
    },
    undo: (state) => {
      if (previousDivisor === null) return state
      return {
        ...state,
        settings: { ...state.settings, snapDivisor: previousDivisor },
      }
    },
  }
}

export function createSetSnapEnabledCommand(
  enabled: boolean,
): Command<ProjectDocument> {
  let previousEnabled: boolean | null = null
  return {
    label: 'settings.setSnapEnabled',
    do: (state) => {
      previousEnabled = state.settings.snapEnabled
      return { ...state, settings: { ...state.settings, snapEnabled: enabled } }
    },
    undo: (state) => {
      if (previousEnabled === null) return state
      return {
        ...state,
        settings: { ...state.settings, snapEnabled: previousEnabled },
      }
    },
  }
}

export function createSetAudioVolumeCommand(
  kind: 'music' | 'sfx',
  value: number,
): Command<ProjectDocument> {
  const key = kind === 'music' ? 'musicVolume' : 'sfxVolume'
  let previousValue: number | null = null
  return {
    label: `audio.set${kind === 'music' ? 'Music' : 'Sfx'}Volume`,
    do: (state) => {
      const clampedVolume = Math.max(0, Math.min(1, value))
      previousValue = state.audio[key]
      return {
        ...state,
        audio: { ...state.audio, [key]: clampedVolume },
      }
    },
    undo: (state) => {
      if (previousValue === null) return state
      return {
        ...state,
        audio: { ...state.audio, [key]: previousValue },
      }
    },
  }
}
