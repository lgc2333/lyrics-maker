import type { InjectionKey, Ref, ShallowRef } from 'vue'

export const MAIN_VIEW_HEIGHT_KEY: InjectionKey<Ref<number>> = Symbol('mainViewHeight')

export const TIMELINE_CONTAINER_REF_KEY: InjectionKey<ShallowRef<HTMLElement | null>> =
  Symbol('timelineContainerRef')

// Phase 4: lyrics editor composable context
export type LyricsEditorContext = import('../../composables/useLyricsEditor').LyricsEditorContext
export const LYRICS_EDITOR_KEY: InjectionKey<LyricsEditorContext> =
  Symbol('lyricsEditor')
