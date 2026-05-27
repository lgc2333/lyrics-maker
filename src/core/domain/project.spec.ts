import { describe, expect, it } from 'vitest'

import { createEmptyProject, parseProjectDocument } from './project'

describe('createEmptyProject', () => {
  it('creates the default project document', () => {
    expect(createEmptyProject()).toEqual({
      version: 1,
      title: 'Untitled Project',
      settings: {
        locale: 'zh-CN',
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
    })
  })

  it('includes phase-2 timing defaults without user preference fields', () => {
    const project = createEmptyProject()
    expect(project.timingPoints).toHaveLength(1)
    expect(project.timingPoints[0].time).toBe(0)
    expect('audio' in project).toBe(false)
    expect('snapDivisor' in project.settings).toBe(false)
    expect('snapEnabled' in project.settings).toBe(false)
  })

  it('returns fresh default project instances', () => {
    const first = createEmptyProject()
    first.timingPoints[0].bpm = 140
    first.lyrics.push({ id: 'line-1', words: [] })

    expect(createEmptyProject()).toEqual({
      version: 1,
      title: 'Untitled Project',
      settings: {
        locale: 'zh-CN',
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
    })
  })
})

describe('parseProjectDocument', () => {
  it('strips unknown legacy project preference fields', () => {
    const project = createEmptyProject()
    const result = parseProjectDocument({
      ...project,
      audio: { musicVolume: 0.25, sfxVolume: 0.5 },
      settings: {
        ...project.settings,
        snapEnabled: false,
        snapDivisor: 8,
      },
    })

    expect(result).toEqual(project)
  })

  it('uses schema defaults for missing project fields', () => {
    const result = parseProjectDocument({ version: 1 })

    expect(result).toEqual(createEmptyProject())
  })

  it('rejects project fields with incompatible types', () => {
    const result = parseProjectDocument({
      ...createEmptyProject(),
      timingPoints: [{ ...createEmptyProject().timingPoints[0], bpm: '120' }],
    })

    expect(result).toBeNull()
  })
})
