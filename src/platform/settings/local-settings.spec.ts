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

  it('accepts system theme mode for following the OS preference', () => {
    const result = parseLocalUserSettings({
      version: 1,
      theme: 'system',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected system theme to parse')
    expect(result.settings.theme).toBe('system')
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

  it('ignores unknown settings fields', () => {
    const result = parseLocalUserSettings({
      ...DEFAULT_LOCAL_USER_SETTINGS,
      audio: {
        musicVolume: 0.2,
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected settings with unknown fields to parse')
    expect('audio' in result.settings).toBe(false)
  })

  it('uses defaults for missing settings fields', () => {
    const result = parseLocalUserSettings({
      version: 1,
      theme: 'dark',
      musicVolume: 0.4,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected partial settings to parse')
    expect(result.settings.theme).toBe('dark')
    expect(result.settings.musicVolume).toBe(0.4)
    expect(result.settings.sfxVolume).toBe(DEFAULT_LOCAL_USER_SETTINGS.sfxVolume)
    expect(result.settings.spectrogramVerticalZoom).toBe(
      DEFAULT_LOCAL_USER_SETTINGS.spectrogramVerticalZoom,
    )
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
