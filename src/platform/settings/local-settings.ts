import { z } from 'zod'

export type LocalTheme = 'light' | 'dark' | 'system'
export type LocalViewMode = 'waveform' | 'spectrogram'
export type LocalRhythmMode = 'common' | 'triplets'
export type LocalSnapDivisor = 1 | 2 | 4 | 8 | 16

export const LOCAL_SETTINGS_STORAGE_KEY = 'lyrics-maker.local-settings.v1'

const localUserSettingsSchema = z.object({
  version: z.literal(1).default(1),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  musicVolume: z.number().min(0).max(1).default(1),
  musicMuted: z.boolean().default(false),
  sfxVolume: z.number().min(0).max(1).default(0.8),
  sfxMuted: z.boolean().default(false),
  viewMode: z.enum(['waveform', 'spectrogram']).default('waveform'),
  spectrogramVerticalZoom: z.number().min(0.5).max(10).default(5),
  autoFollowPlayback: z.boolean().default(true),
  metronomeEnabled: z.boolean().default(false),
  snapEnabled: z.boolean().default(true),
  snapDivisor: z
    .union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16)])
    .default(4),
  rhythmMode: z.enum(['common', 'triplets']).default('common'),
  mainViewHeight: z.number().min(180).max(520).default(250),
})

export type LocalUserSettings = z.infer<typeof localUserSettingsSchema>

export const DEFAULT_LOCAL_USER_SETTINGS: LocalUserSettings =
  localUserSettingsSchema.parse({})

export type LocalSettingsParseResult =
  | { ok: true; settings: LocalUserSettings }
  | { ok: false; reason: 'invalid'; errorMessage?: string }

export type LocalSettingsStorageResult =
  | { ok: true; settings: LocalUserSettings }
  | { ok: false; reason: 'invalid' | 'failed'; errorMessage?: string }

export type LocalSettingsSaveResult =
  | { ok: true }
  | { ok: false; reason: 'failed'; errorMessage?: string }

export function parseLocalUserSettings(value: unknown): LocalSettingsParseResult {
  const result = localUserSettingsSchema.safeParse(value)
  if (!result.success) {
    return { ok: false, reason: 'invalid', errorMessage: result.error.message }
  }
  return { ok: true, settings: result.data }
}

export function createLocalSettingsService(storage: Storage = localStorage) {
  function load(): LocalSettingsStorageResult {
    let content: string | null
    try {
      content = storage.getItem(LOCAL_SETTINGS_STORAGE_KEY)
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
    if (content === null) {
      return { ok: true, settings: structuredClone(DEFAULT_LOCAL_USER_SETTINGS) }
    }
    try {
      const parsed = parseLocalUserSettings(JSON.parse(content) as unknown)
      if (!parsed.ok) return parsed
      return parsed
    } catch (error) {
      return {
        ok: false,
        reason: 'invalid',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
  }

  function save(settings: LocalUserSettings): LocalSettingsSaveResult {
    try {
      storage.setItem(LOCAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings, null, 2))
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
  }

  function exportToText(settings: LocalUserSettings): string {
    return JSON.stringify(settings, null, 2)
  }

  function importFromText(content: string): LocalSettingsStorageResult {
    try {
      const parsed = parseLocalUserSettings(JSON.parse(content) as unknown)
      if (!parsed.ok) return parsed
      const saveResult = save(parsed.settings)
      if (!saveResult.ok) return saveResult
      return parsed
    } catch (error) {
      return {
        ok: false,
        reason: 'invalid',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
  }

  return { load, save, exportToText, importFromText }
}
