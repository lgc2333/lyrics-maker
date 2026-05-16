export type LocaleCode = 'zh-CN'

export interface ProjectSettings {
  locale: LocaleCode
  snapDivisor: 4 | 8 | 16
}

export interface LyricWord {
  id: string
  text: string
  startTime: number
  endTime: number
}

export interface LyricLine {
  id: string
  text: string
  words: LyricWord[]
}

export interface ProjectDocument {
  version: 1
  title: string
  settings: ProjectSettings
  lyrics: LyricLine[]
}

export function createEmptyProject(): ProjectDocument {
  return {
    version: 1,
    title: 'Untitled Project',
    settings: {
      locale: 'zh-CN',
      snapDivisor: 4,
    },
    lyrics: [],
  }
}
