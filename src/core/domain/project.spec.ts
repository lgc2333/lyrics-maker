import { describe, expect, it } from 'vitest'

import { createEmptyProject } from './project'

describe('createEmptyProject', () => {
  it('creates an empty project seed', () => {
    expect(createEmptyProject()).toEqual({
      id: '',
      name: '',
      description: '',
    })
  })
})
