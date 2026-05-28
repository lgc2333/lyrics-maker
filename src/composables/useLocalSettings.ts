import { onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import {
  DEFAULT_LOCAL_USER_SETTINGS,
  DEFAULT_LOCAL_USER_STATE,
  createLocalSettingsService,
} from '../platform/settings/local-settings'
import type {
  LocalLocale,
  LocalTheme,
  LocalUserSettings,
  LocalUserState,
} from '../platform/settings/local-settings'
import { useEditorStore } from '../stores/editor-store'
import type { TimelineViewContext } from './useTimelineView'

interface UseLocalSettingsOptions {
  locale: Ref<LocalLocale>
  theme: Ref<LocalTheme>
  mainViewHeight: Ref<number>
  timeline: TimelineViewContext
}

export type UseLocalSettingsContext = ReturnType<typeof useLocalSettings>

export function useLocalSettings(options: UseLocalSettingsOptions) {
  const store = useEditorStore()
  const service = createLocalSettingsService()
  const settings = ref<LocalUserSettings>(structuredClone(DEFAULT_LOCAL_USER_SETTINGS))
  const state = ref<LocalUserState>(structuredClone(DEFAULT_LOCAL_USER_STATE))
  let hydrated = false

  function buildSettings(): LocalUserSettings {
    return {
      ...DEFAULT_LOCAL_USER_SETTINGS,
      locale: options.locale.value,
      theme: options.theme.value,
    }
  }

  function buildState(): LocalUserState {
    return {
      ...store.exportLocalStateBase(),
      viewMode: options.timeline.viewMode.value,
      spectrogramVerticalZoom: options.timeline.verticalZoom.value,
      autoFollowPlayback: options.timeline.autoFollowPlayback.value,
      mainViewHeight: options.mainViewHeight.value,
    }
  }

  function applySettings(
    nextSettings: LocalUserSettings,
    nextState: LocalUserState = structuredClone(DEFAULT_LOCAL_USER_STATE),
  ): void {
    settings.value = structuredClone(nextSettings)
    state.value = structuredClone(nextState)
    store.applyLocalState(nextState)
    options.locale.value = nextSettings.locale
    options.theme.value = nextSettings.theme
    options.timeline.setViewMode(nextState.viewMode)
    options.timeline.setVerticalZoom(nextState.spectrogramVerticalZoom)
    options.timeline.setAutoFollowPlayback(nextState.autoFollowPlayback)
    options.mainViewHeight.value = nextState.mainViewHeight
  }

  function logLocalSettingsFailure(
    operation: 'load' | 'save' | 'import',
    reason: string,
    errorMessage?: string,
  ): void {
    console.warn(
      `[settings] Failed to ${operation} local settings:`,
      errorMessage ?? reason,
    )
  }

  onMounted(() => {
    const result = service.load()
    if (result.ok) {
      applySettings(result.settings, result.state)
    } else {
      logLocalSettingsFailure('load', result.reason, result.errorMessage)
      store.showStatus('status.localSettings.loadFailed', {
        reason: result.reason,
      })
    }
    hydrated = true
  })

  watch(
    [
      () => options.theme.value,
      () => options.locale.value,
      () => store.musicVolume,
      () => store.musicMuted,
      () => store.sfxVolume,
      () => store.sfxMuted,
      () => options.timeline.viewMode.value,
      () => options.timeline.verticalZoom.value,
      () => options.timeline.autoFollowPlayback.value,
      () => store.metronomeState,
      () => store.snapEnabled,
      () => store.snapDivisor,
      () => store.rhythmMode,
      () => options.mainViewHeight.value,
    ],
    () => {
      if (!hydrated) return
      const nextSettings = buildSettings()
      const nextState = buildState()
      settings.value = nextSettings
      state.value = nextState
      const result = service.save(nextSettings, nextState)
      if (!result.ok) {
        logLocalSettingsFailure('save', result.reason, result.errorMessage)
        store.showStatus('status.localSettings.saveFailed', {
          reason: result.reason,
        })
      }
    },
  )

  function exportToText(): string {
    return service.exportToText(buildSettings(), buildState())
  }

  function importFromText(content: string): boolean {
    const result = service.importFromText(content, buildState())
    if (!result.ok) {
      logLocalSettingsFailure('import', result.reason, result.errorMessage)
      store.showStatus('status.localSettings.importFailed', {
        reason: result.reason,
      })
      return false
    }
    applySettings(result.settings, result.state)
    store.showStatus('status.localSettings.importSuccess')
    return true
  }

  function reportExportSuccess(): void {
    store.showStatus('status.localSettings.exportSuccess')
  }

  function reportImportCancelled(): void {
    store.showStatus('status.localSettings.importCancelled')
  }

  return {
    settings,
    state,
    exportToText,
    importFromText,
    reportExportSuccess,
    reportImportCancelled,
  }
}
