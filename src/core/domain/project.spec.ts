import { describe, expect, it } from 'vitest'

import { createEmptyProject } from './project'

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
})
