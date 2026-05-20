import type { ProjectDocument } from '../domain/project'
import type { Command } from './command'

export function createSetLineStartTimeCommand(
  lineId: string,
  time: number,
): Command<ProjectDocument> {
  let previousStartTime: number | undefined | null = null
  return {
    label: 'lyrics.setLineStartTime',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      if (previousStartTime === null) previousStartTime = line.startTime
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, startTime: time } : l,
        ),
      }
    },
    undo: (state) => {
      if (previousStartTime === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, startTime: previousStartTime! } : l,
        ),
      }
    },
  }
}

export function createSetWordEndTimeCommand(
  lineId: string,
  wordId: string,
  time: number,
): Command<ProjectDocument> {
  let previousEndTime: number | undefined | null = null
  return {
    label: 'lyrics.setWordEndTime',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const word = line.words.find((w) => w.id === wordId)
      if (!word) return state
      if (previousEndTime === null) previousEndTime = word.endTime
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, endTime: time } : w,
                ),
              }
            : l,
        ),
      }
    },
    undo: (state) => {
      if (previousEndTime === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, endTime: previousEndTime! } : w,
                ),
              }
            : l,
        ),
      }
    },
  }
}

export function createClearWordEndTimeCommand(
  lineId: string,
  wordId: string,
): Command<ProjectDocument> {
  let previousEndTime: number | undefined | null = null
  return {
    label: 'lyrics.clearWordEndTime',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const word = line.words.find((w) => w.id === wordId)
      if (!word) return state
      if (previousEndTime === null) previousEndTime = word.endTime
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, endTime: undefined } : w,
                ),
              }
            : l,
        ),
      }
    },
    undo: (state) => {
      if (previousEndTime === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, endTime: previousEndTime! } : w,
                ),
              }
            : l,
        ),
      }
    },
  }
}
