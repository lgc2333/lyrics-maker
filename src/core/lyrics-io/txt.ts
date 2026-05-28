import { lineText, textToUntimedWords } from './line-builder'
import type { LyricsFormatAdapter } from './types'

export const txtAdapter: LyricsFormatAdapter = {
  id: 'txt',
  label: 'TXT',
  extension: 'txt',
  parse(text) {
    return {
      lines: text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => ({ words: textToUntimedWords(line) })),
    }
  },
  export(input) {
    return input.project.lyrics.map(lineText).join('\n')
  },
}
