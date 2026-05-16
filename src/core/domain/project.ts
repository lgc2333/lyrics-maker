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

export interface TimingPoint {
  id: string
  time: number
  bpm: number
  timeSignatureNumerator: number
  timeSignatureDenominator: number
  offsetMs: number
}

export interface ProjectDocument {
  version: 1
  title: string
  settings: ProjectSettings
  lyrics: LyricLine[]
  timingPoints: TimingPoint[]
  audio: { musicVolume: number; sfxVolume: number }
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
    timingPoints: [
      {
        id: 'tp-1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
        offsetMs: 0,
      },
    ],
    audio: {
      musicVolume: 1,
      sfxVolume: 0.8,
    },
  }
}
