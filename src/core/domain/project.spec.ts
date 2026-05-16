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
      },
      lyrics: [],
    })
  })
})
