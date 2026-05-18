import { describe, expect, it } from 'vitest'

import { createEmptyProject } from './project'

describe('createEmptyProject', () => {
  it('creates the default project document', () => {
    expect(createEmptyProject()).toEqual({
      version: 1,
      title: 'Untitled Project',
      settings: {
        locale: 'zh-CN',
        snapDivisor: 4,
        rhythmMode: 'common',
      },
      lyrics: [],
      timingPoints: [
        {
          id: 'tp-1',
          time: 0,
          bpm: 120,
          timeSignatureNumerator: 4,
          timeSignatureDenominator: 4,
        },
      ],
      audio: {
        musicVolume: 1,
        sfxVolume: 0.8,
      },
    })
  })

  it('includes phase-2 timing and volume defaults', () => {
    const project = createEmptyProject()
    expect(project.timingPoints).toHaveLength(1)
    expect(project.timingPoints[0].time).toBe(0)
    expect(project.audio.musicVolume).toBe(1)
    expect(project.audio.sfxVolume).toBe(0.8)
  })

  it('has snapDivisor defaulting to 4', () => {
    const p = createEmptyProject()
    expect(p.settings.snapDivisor).toBe(4)
  })

  it('has rhythmMode defaulting to common', () => {
    const p = createEmptyProject()
    expect(p.settings.rhythmMode).toBe('common')
  })
})
