import type { LyricLine, ProjectDocument } from '../domain/project'
import type { Command } from './command'

export function createSplitWordCommand(
  lineId: string,
  wordId: string,
  charIndex: number,
  newId: string,
): Command<ProjectDocument> {
  if (charIndex <= 0) {
    throw new Error('charIndex must be > 0 (would produce empty front word)')
  }
  return {
    label: 'lyrics.splitWord',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const wordIndex = line.words.findIndex((w) => w.id === wordId)
      if (wordIndex === -1) return state
      const word = line.words[wordIndex]
      if (charIndex >= word.text.length) {
        throw new Error(
          'charIndex must be < text.length (would produce empty back word)',
        )
      }
      const frontText = word.text.slice(0, charIndex)
      const backText = word.text.slice(charIndex)
      const frontWord = { id: word.id, text: frontText }
      const backWord = { id: newId, text: backText, endTime: word.endTime }
      const newWords = [...line.words]
      newWords.splice(wordIndex, 1, frontWord, backWord)
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
    undo: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const frontIndex = line.words.findIndex((w) => w.id === wordId)
      const backIndex = line.words.findIndex((w) => w.id === newId)
      if (frontIndex === -1 || backIndex === -1) return state
      const front = line.words[frontIndex]
      const back = line.words[backIndex]
      const merged = { id: wordId, text: front.text + back.text, endTime: back.endTime }
      const newWords = [...line.words]
      newWords.splice(Math.min(frontIndex, backIndex), 2, merged)
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
  }
}

export function createMergeWordsCommand(
  lineId: string,
  wordId: string,
): Command<ProjectDocument> {
  let removedWord: { id: string; text: string; endTime?: number } | null = null
  let originalFrontEndTime: number | undefined | null = null
  return {
    label: 'lyrics.mergeWords',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const wordIndex = line.words.findIndex((w) => w.id === wordId)
      if (wordIndex === -1 || wordIndex >= line.words.length - 1) {
        throw new Error('Cannot merge: wordId is the last word or not found')
      }
      const front = line.words[wordIndex]
      const back = line.words[wordIndex + 1]
      if (removedWord === null) {
        removedWord = { id: back.id, text: back.text, endTime: back.endTime }
        originalFrontEndTime = front.endTime
      }
      const merged = {
        id: front.id,
        text: front.text + back.text,
        endTime: back.endTime,
      }
      const newWords = [...line.words]
      newWords.splice(wordIndex, 2, merged)
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
    undo: (state) => {
      if (!removedWord) return state
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const mergedIndex = line.words.findIndex((w) => w.id === wordId)
      if (mergedIndex === -1) return state
      const merged = line.words[mergedIndex]
      const frontText = merged.text.slice(
        0,
        merged.text.length - removedWord.text.length,
      )
      const frontWord = {
        id: wordId,
        text: frontText,
        endTime: originalFrontEndTime ?? undefined,
      }
      const backWord = {
        id: removedWord.id,
        text: removedWord.text,
        endTime: removedWord.endTime,
      }
      const newWords = [...line.words]
      newWords.splice(mergedIndex, 1, frontWord, backWord)
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
  }
}

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

export function createUpdateWordTextCommand(
  lineId: string,
  wordId: string,
  newText: string,
): Command<ProjectDocument> {
  let previousText: string | null = null
  return {
    label: 'lyrics.updateWordText',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const word = line.words.find((w) => w.id === wordId)
      if (!word) return state
      if (previousText === null) previousText = word.text
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, text: newText } : w,
                ),
              }
            : l,
        ),
      }
    },
    undo: (state) => {
      if (previousText === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, text: previousText! } : w,
                ),
              }
            : l,
        ),
      }
    },
  }
}

export function createInsertWordCommand(
  lineId: string,
  insertIndex: number,
  word: { id: string; text: string },
): Command<ProjectDocument> {
  return {
    label: 'lyrics.insertWord',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const newWords = [...line.words]
      newWords.splice(insertIndex, 0, { id: word.id, text: word.text })
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
    undo: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? { ...l, words: l.words.filter((w) => w.id !== word.id) }
            : l,
        ),
      }
    },
  }
}

export function createReplaceLineWordsCommand(
  lineId: string,
  newWords: readonly { id: string; text: string }[],
): Command<ProjectDocument> {
  let previousWords: LyricLine['words'] | null = null
  let previousStartTime: number | undefined | null = null
  return {
    label: 'lyrics.replaceLineWords',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      if (previousWords === null) {
        previousWords = line.words
        previousStartTime = line.startTime
      }
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: [...newWords], startTime: undefined } : l,
        ),
      }
    },
    undo: (state) => {
      if (previousWords === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: previousWords!,
                startTime: previousStartTime ?? undefined,
              }
            : l,
        ),
      }
    },
  }
}

export function createInsertLyricLinesCommand(
  lines: readonly LyricLine[],
): Command<ProjectDocument> {
  for (const line of lines) {
    if (line.words.length === 0) {
      throw new Error('LyricLine words array must not be empty')
    }
  }
  const lineIds = lines.map((l) => l.id)
  return {
    label: 'lyrics.insertLines',
    do: (state) => ({
      ...state,
      lyrics: [...state.lyrics, ...lines],
    }),
    undo: (state) => ({
      ...state,
      lyrics: state.lyrics.filter((l) => !lineIds.includes(l.id)),
    }),
  }
}

export function createRemoveLyricLineCommand(lineId: string): Command<ProjectDocument> {
  let removedLine: LyricLine | null = null
  let removedIndex: number | null = null
  return {
    label: 'lyrics.removeLine',
    do: (state) => {
      const index = state.lyrics.findIndex((l) => l.id === lineId)
      if (index === -1) return state
      if (removedLine === null) {
        removedLine = state.lyrics[index]
        removedIndex = index
      }
      return {
        ...state,
        lyrics: state.lyrics.filter((l) => l.id !== lineId),
      }
    },
    undo: (state) => {
      if (removedLine === null || removedIndex === null) return state
      const newLyrics = [...state.lyrics]
      newLyrics.splice(removedIndex, 0, removedLine)
      return {
        ...state,
        lyrics: newLyrics,
      }
    },
  }
}
