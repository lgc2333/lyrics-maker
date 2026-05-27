import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOCAL_USER_SETTINGS,
  createLocalSettingsService,
  parseLocalUserSettings,
} from './local-settings'

describe('local settings validation', () => {
  it('defaults spectrogram vertical zoom to 500 percent', () => {
    expect(DEFAULT_LOCAL_USER_SETTINGS.spectrogramVerticalZoom).toBe(5)
  })

  it('accepts a complete local settings payload', () => {
    const result = parseLocalUserSettings({
      version: 1,
      theme: 'dark',
      musicVolume: 0.4,
      musicMuted: true,
      sfxVolume: 0.7,
      sfxMuted: false,
      viewMode: 'spectrogram',
      spectrogramVerticalZoom: 6,
      autoFollowPlayback: false,
      metronomeEnabled: true,
      snapEnabled: false,
      snapDivisor: 8,
      rhythmMode: 'triplets',
      mainViewHeight: 320,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected valid local settings')
    expect(result.settings.theme).toBe('dark')
    expect(result.settings.snapDivisor).toBe(8)
  })

  it('rejects imported settings with invalid structure', () => {
    const result = parseLocalUserSettings({
      version: 1,
      theme: 'blue',
      musicVolume: 2,
      snapDivisor: 3,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected invalid local settings')
    expect(result.reason).toBe('invalid')
  })

  it('rejects settings payloads with unknown fields', () => {
    const result = parseLocalUserSettings({
      ...DEFAULT_LOCAL_USER_SETTINGS,
      audio: {
        musicVolume: 0.2,
      },
    })

    expect(result.ok).toBe(false)
  })
})

describe('local settings service', () => {
  it('loads defaults when storage is empty', () => {
    const service = createLocalSettingsService(localStorage)
    localStorage.clear()

    const result = service.load()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected default local settings')
    expect(result.settings).toEqual(DEFAULT_LOCAL_USER_SETTINGS)
  })

  it('saves and reloads valid settings', () => {
    const service = createLocalSettingsService(localStorage)
    localStorage.clear()

    service.save({ ...DEFAULT_LOCAL_USER_SETTINGS, musicVolume: 0.25 })

    const result = service.load()
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected saved local settings')
    expect(result.settings.musicVolume).toBe(0.25)
  })

  it('validates import text before saving', () => {
    const service = createLocalSettingsService(localStorage)
    localStorage.clear()

    const result = service.importFromText('{"version":1,"theme":"nope"}')

    expect(result.ok).toBe(false)
    expect(localStorage.getItem('lyrics-maker.local-settings.v1')).toBeNull()
  })
})
