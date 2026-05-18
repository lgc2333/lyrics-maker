<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'

import { useEditorShortcuts } from '../../composables/useEditorShortcuts'
import { useProjectPersistence } from '../../composables/useProjectPersistence'
import {
  TIMELINE_VIEW_KEY,
  useTimelineView,
} from '../../composables/useTimelineView'
import { useEditorStore } from '../../stores/editor-store'
import LyricsPanel from './LyricsPanel.vue'
import MainView from './MainView.vue'
import MenuBar from './MenuBar.vue'
import TimingPointsPanel from './TimingPointsPanel.vue'
import TransportBar from './TransportBar.vue'

const store = useEditorStore()
const persistence = useProjectPersistence()

const editorMode = ref<'timing' | 'lyrics'>('timing')
const theme = ref<'light' | 'dark'>('light')
const followSystemTheme = ref(true)
const audioInput = ref<HTMLInputElement | null>(null)

// ---- Timeline view ----
const timelineContainerRef = shallowRef<HTMLElement | null>(null)
const timeline = useTimelineView(timelineContainerRef)

provide(TIMELINE_VIEW_KEY, timeline)
provide('timelineContainerRef', timelineContainerRef)

function detectSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function toggleTheme(): void {
  followSystemTheme.value = false
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function openAudioPicker(): void {
  audioInput.value?.click()
}

async function onAudioSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await store.importAudioFile(file)
  input.value = ''
}

let mediaQuery: MediaQueryList | null = null
let mediaQueryHandler: ((event: MediaQueryListEvent) => void) | null = null

onMounted(() => {
  theme.value = detectSystemTheme()
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQueryHandler = (event: MediaQueryListEvent) => {
    if (!followSystemTheme.value) return
    theme.value = event.matches ? 'dark' : 'light'
  }
  mediaQuery.addEventListener('change', mediaQueryHandler)
})

onBeforeUnmount(() => {
  if (mediaQuery && mediaQueryHandler) {
    mediaQuery.removeEventListener('change', mediaQueryHandler)
  }
})

watch(
  theme,
  (nextTheme) => {
    document.documentElement.setAttribute('data-theme', nextTheme)
  },
  { immediate: true },
)

useEditorShortcuts({
  onAction: async (action) => {
    if (action === 'history.undo') store.undo()
    else if (action === 'history.redo') store.redo()
    else if (action === 'project.save') await persistence.saveByShortcut()
    else if (action === 'transport.togglePlay') store.togglePlayback()
    else if (action === 'timing.tapBpm') store.tapBpm()
    else if (action === 'metronome.toggle') store.toggleMetronome()
    else if (action === 'transport.prevBeat')
      store.seekToPrevBeat(
        timeline.divisor.value,
        timeline.effectiveTriplets.value,
      )
    else if (action === 'transport.nextBeat')
      store.seekToNextBeat(
        timeline.divisor.value,
        timeline.effectiveTriplets.value,
      )
    else if (action === 'transport.prevBar') store.seekToPreviousBar()
    else if (action === 'transport.nextBar') store.seekToNextBar()
  },
})
</script>

<template>
  <div class="flex h-screen flex-col">
    <MenuBar
      data-testid="menu-bar"
      :mode="editorMode"
      :theme="theme"
      @switchMode="editorMode = $event"
      @toggleTheme="toggleTheme"
      @openAudioFile="openAudioPicker"
    />
    <input
      ref="audioInput"
      data-testid="audio-file-input"
      type="file"
      accept="audio/*"
      class="hidden"
      @change="onAudioSelected"
    />
    <MainView data-testid="main-view" />
    <TransportBar data-testid="transport-bar" />
    <TimingPointsPanel
      v-if="editorMode === 'timing'"
      data-testid="timing-points-panel"
    />
    <LyricsPanel v-else data-testid="lyrics-panel" />
  </div>
</template>
