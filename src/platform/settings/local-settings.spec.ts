import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOCAL_USER_SETTINGS,
  DEFAULT_LOCAL_USER_STATE,
  createLocalSettingsService,
  parseLocalUserSettings,
} from './local-settings'

describe('local settings validation', () => {
  it('defaults spectrogram vertical zoom to 500 percent', () => {
    expect(DEFAULT_LOCAL_USER_STATE.spectrogramVerticalZoom).toBe(5)
  })

  it('defaults grid visibility to on', () => {
    expect(DEFAULT_LOCAL_USER_STATE.gridVisible).toBe(true)
  })

  it('defaults shortcutOverrides to an empty object', () => {
    expect(DEFAULT_LOCAL_USER_STATE.shortcutOverrides).toEqual({})
  })

  it('accepts a complete local settings payload', () => {
    const result = parseLocalUserSettings({
      version: 1,
      locale: 'zh-CN',
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
    expect(result.settings.locale).toBe('zh-CN')
    expect(result.settings.theme).toBe('dark')
    expect('musicVolume' in result.settings).toBe(false)
    expect('snapDivisor' in result.settings).toBe(false)
  })

  it('accepts system locale mode for following the browser preference', () => {
    const result = parseLocalUserSettings({
      version: 1,
      locale: 'system',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected system locale to parse')
    expect(result.settings.locale).toBe('system')
  })

  it('accepts en-US as a supported locale value', () => {
    const result = parseLocalUserSettings({
      version: 1,
      locale: 'en-US',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected en-US locale to parse')
    expect(result.settings.locale).toBe('en-US')
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
    expect(result.settings.locale).toBe(DEFAULT_LOCAL_USER_SETTINGS.locale)
    expect(result.settings.theme).toBe('dark')
    expect('musicVolume' in result.settings).toBe(false)
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
    expect(result.state).toEqual(DEFAULT_LOCAL_USER_STATE)
  })

  it('saves visible settings and hidden state together', () => {
    const service = createLocalSettingsService(localStorage)
    localStorage.clear()

    service.save(
      { ...DEFAULT_LOCAL_USER_SETTINGS, theme: 'dark' },
      {
        ...DEFAULT_LOCAL_USER_STATE,
        musicVolume: 0.25,
        snapDivisor: 8,
        gridVisible: false,
        shortcutOverrides: { 'lyrics.mark2': 'Q', 'lyrics.editWholeLine': null },
      },
    )

    const result = service.load()
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected saved local settings')
    expect(result.settings).toEqual({
      version: 1,
      locale: 'system',
      theme: 'dark',
    })
    expect(result.state.musicVolume).toBe(0.25)
    expect(result.state.snapDivisor).toBe(8)
    expect(result.state.gridVisible).toBe(false)
    expect(result.state.shortcutOverrides).toEqual({
      'lyrics.mark2': 'Q',
      'lyrics.editWholeLine': null,
    })
  })

  it('accepts shortcutOverrides with null values', () => {
    const service = createLocalSettingsService(localStorage)
    localStorage.clear()

    service.save(DEFAULT_LOCAL_USER_SETTINGS, {
      ...DEFAULT_LOCAL_USER_STATE,
      shortcutOverrides: { 'lyrics.mark': null },
    })

    const result = service.load()
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected load to succeed')
    expect(result.state.shortcutOverrides).toEqual({ 'lyrics.mark': null })
  })

  it('validates import text before saving', () => {
    const service = createLocalSettingsService(localStorage)
    localStorage.clear()

    const result = service.importFromText('{"version":1,"theme":"nope"}')

    expect(result.ok).toBe(false)
    expect(localStorage.getItem('lyrics-maker.local-settings.v1')).toBeNull()
  })

  it('exports only visible settings and omits local user state', () => {
    const service = createLocalSettingsService(localStorage)
    const text = service.exportToText(
      { ...DEFAULT_LOCAL_USER_SETTINGS, theme: 'dark', locale: 'system' },
      {
        ...DEFAULT_LOCAL_USER_STATE,
        viewMode: 'spectrogram',
        spectrogramVerticalZoom: 7,
        autoFollowPlayback: false,
        gridVisible: false,
        mainViewHeight: 360,
      },
    )

    const exported = JSON.parse(text)
    expect(exported).toEqual({
      version: 1,
      locale: 'system',
      theme: 'dark',
    })
    expect(exported.musicVolume).toBeUndefined()
    expect(exported.snapDivisor).toBeUndefined()
    expect(exported.viewMode).toBeUndefined()
    expect(exported.spectrogramVerticalZoom).toBeUndefined()
    expect(exported.autoFollowPlayback).toBeUndefined()
    expect(exported.gridVisible).toBeUndefined()
    expect(exported.mainViewHeight).toBeUndefined()
  })
})
