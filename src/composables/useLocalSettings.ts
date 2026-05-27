import { onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import {
  DEFAULT_LOCAL_USER_SETTINGS,
  createLocalSettingsService,
} from '../platform/settings/local-settings'
import type { LocalUserSettings } from '../platform/settings/local-settings'
import { useEditorStore } from '../stores/editor-store'
import type { TimelineViewContext } from './useTimelineView'

interface UseLocalSettingsOptions {
  theme: Ref<'light' | 'dark'>
  mainViewHeight: Ref<number>
  timeline: TimelineViewContext
}

export type UseLocalSettingsContext = ReturnType<typeof useLocalSettings>

export function useLocalSettings(options: UseLocalSettingsOptions) {
  const store = useEditorStore()
  const service = createLocalSettingsService()
  const settings = ref<LocalUserSettings>(structuredClone(DEFAULT_LOCAL_USER_SETTINGS))
  let hydrated = false

  function buildSettings(): LocalUserSettings {
    return {
      ...store.exportLocalSettingsBase(),
      theme: options.theme.value,
      viewMode: options.timeline.viewMode.value,
      spectrogramVerticalZoom: options.timeline.verticalZoom.value,
      autoFollowPlayback: options.timeline.autoFollowPlayback.value,
      mainViewHeight: options.mainViewHeight.value,
    }
  }

  function applySettings(nextSettings: LocalUserSettings): void {
    settings.value = structuredClone(nextSettings)
    store.applyLocalSettings(nextSettings)
    options.theme.value = nextSettings.theme
    options.timeline.setViewMode(nextSettings.viewMode)
    options.timeline.setVerticalZoom(nextSettings.spectrogramVerticalZoom)
    options.timeline.setAutoFollowPlayback(nextSettings.autoFollowPlayback)
    options.mainViewHeight.value = nextSettings.mainViewHeight
  }

  onMounted(() => {
    const result = service.load()
    if (result.ok) {
      applySettings(result.settings)
    } else {
      store.showStatus('status.localSettings.loadFailed', {
        reason: result.reason,
      })
    }
    hydrated = true
  })

  watch(
    [
      () => options.theme.value,
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
      settings.value = nextSettings
      const result = service.save(nextSettings)
      if (!result.ok) {
        store.showStatus('status.localSettings.saveFailed', {
          reason: result.errorMessage ?? result.reason,
        })
      }
    },
  )

  function exportToText(): string {
    return service.exportToText(buildSettings())
  }

  function importFromText(content: string): boolean {
    const result = service.importFromText(content)
    if (!result.ok) {
      store.showStatus('status.localSettings.importFailed', {
        reason: result.errorMessage ?? result.reason,
      })
      return false
    }
    applySettings(result.settings)
    store.showStatus('status.localSettings.importSuccess')
    return true
  }

  function reportExportSuccess(): void {
    store.showStatus('status.localSettings.exportSuccess')
  }

  return {
    settings,
    exportToText,
    importFromText,
    reportExportSuccess,
  }
}
