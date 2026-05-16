import type { Command } from './command'
import type { ProjectDocument } from '../domain/project'

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
