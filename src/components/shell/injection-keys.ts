import type { InjectionKey, Ref, ShallowRef } from 'vue'

import type { UseLocalSettingsContext } from '../../composables/useLocalSettings'

export const MAIN_VIEW_HEIGHT_KEY: InjectionKey<Ref<number>> = Symbol('mainViewHeight')

export const TIMELINE_CONTAINER_REF_KEY: InjectionKey<ShallowRef<HTMLElement | null>> =
  Symbol('timelineContainerRef')

// Phase 4: lyrics editor composable context
export type LyricsEditorContext =
  import('../../composables/useLyricsEditor').LyricsEditorContext
export const LYRICS_EDITOR_KEY: InjectionKey<LyricsEditorContext> =
  Symbol('lyricsEditor')

export const LOCAL_SETTINGS_KEY: InjectionKey<UseLocalSettingsContext> =
  Symbol('localSettings')
