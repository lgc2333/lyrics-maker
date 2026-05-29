import { describe, expect, it } from 'vitest'

import { APP_COMMIT, APP_VERSION } from './version'

describe('version constants', () => {
  it('exposes a non-empty version string', () => {
    expect(typeof APP_VERSION).toBe('string')
    expect(APP_VERSION.length).toBeGreaterThan(0)
  })

  it('exposes a non-empty commit string', () => {
    expect(typeof APP_COMMIT).toBe('string')
    expect(APP_COMMIT.length).toBeGreaterThan(0)
  })
})
