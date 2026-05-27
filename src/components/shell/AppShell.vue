<script setup lang="ts">
import { computed, provide, ref, shallowRef, watch } from 'vue'

import { useEditorShortcuts } from '../../composables/useEditorShortcuts'
import { useLocalSettings } from '../../composables/useLocalSettings'
import { useLyricsEditor } from '../../composables/useLyricsEditor'
import { useProjectPersistence } from '../../composables/useProjectPersistence'
import { TIMELINE_VIEW_KEY, useTimelineView } from '../../composables/useTimelineView'
import type { LyricLine, LyricWord } from '../../core/domain/project'
import { autoSplitText } from '../../core/lyrics/auto-split'
import { createPrefixedId } from '../../platform/ids/create-id'
import { useEditorStore } from '../../stores/editor-store'
import LyricsPanel from './LyricsPanel.vue'
import LyricsPasteModal from './LyricsPasteModal.vue'
import MainView from './MainView.vue'
import MenuBar from './MenuBar.vue'
import PreferencesModal from './PreferencesModal.vue'
import StatusBar from './StatusBar.vue'
import TimingPointsPanel from './TimingPointsPanel.vue'
import TransportBar from './TransportBar.vue'
import UnsavedChangesDialog from './UnsavedChangesDialog.vue'
import {
  LOCAL_SETTINGS_KEY,
  LYRICS_EDITOR_KEY,
  MAIN_VIEW_HEIGHT_KEY,
  TIMELINE_CONTAINER_REF_KEY,
} from './injection-keys'

const store = useEditorStore()
const persistence = useProjectPersistence()

const editorMode = ref<'timing' | 'lyrics'>('timing')
const lyricsEditor = useLyricsEditor()
provide(LYRICS_EDITOR_KEY, lyricsEditor)
const theme = ref<'light' | 'dark'>('light')
const audioInput = ref<HTMLInputElement | null>(null)
const showPasteModal = ref(false)
const showUnsavedOpenDialog = ref(false)
const showPreferencesModal = ref(false)

// ---- Timeline view ----
const timelineContainerRef = shallowRef<HTMLElement | null>(null)
const timeline = useTimelineView(timelineContainerRef, {
  onExplicitSeek: (time) => lyricsEditor.selectTimedWordAt(time),
  activeLyricSelection: computed(() => ({
    lineId: lyricsEditor.activeLineId.value,
    wordIndex: lyricsEditor.activeWordIndex.value,
  })),
})

provide(TIMELINE_VIEW_KEY, timeline)
provide(TIMELINE_CONTAINER_REF_KEY, timelineContainerRef)

// ---- MainView resize ----
const mainViewHeight = ref(250)
const RESIZE_MIN = 180
const RESIZE_MAX = 520

let resizeDragging = false
let resizeStartY = 0
let resizeStartH = 0

function onResizePointerDown(e: PointerEvent) {
  resizeDragging = true
  resizeStartY = e.clientY
  resizeStartH = mainViewHeight.value
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onResizePointerMove(e: PointerEvent) {
  if (!resizeDragging) return
  const delta = e.clientY - resizeStartY
  mainViewHeight.value = Math.max(
    RESIZE_MIN,
    Math.min(RESIZE_MAX, resizeStartH + delta),
  )
}

function onResizePointerUp() {
  resizeDragging = false
}

provide(MAIN_VIEW_HEIGHT_KEY, mainViewHeight)

const localSettings = useLocalSettings({
  theme,
  mainViewHeight,
  timeline,
})
provide(LOCAL_SETTINGS_KEY, localSettings)

function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function onExportSettings(): void {
  localSettings.reportExportSuccess()
}

function onImportSettings(content: string): void {
  localSettings.importFromText(content)
}

function openAudioPicker(): void {
  audioInput.value?.click()
}

async function openProjectNow(): Promise<void> {
  await persistence.openProject()
}

async function requestOpenProject(): Promise<void> {
  if (!store.dirty) {
    await openProjectNow()
    return
  }
  showUnsavedOpenDialog.value = true
}

async function saveAndOpenProject(): Promise<void> {
  showUnsavedOpenDialog.value = false
  const result = await persistence.saveByShortcut()
  if (result?.ok) {
    await openProjectNow()
  }
}

async function discardAndOpenProject(): Promise<void> {
  showUnsavedOpenDialog.value = false
  await openProjectNow()
}

function cancelOpenProject(): void {
  showUnsavedOpenDialog.value = false
  store.showStatus('status.project.openCancelled')
}

async function onAudioSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await store.importAudioFile(file)
  input.value = ''
}

function onPasteLyricsConfirm(text: string): void {
  showPasteModal.value = false
  const rawLines = text.split('\n').filter((l) => l.trim().length > 0)
  const lines: LyricLine[] = rawLines.map((rawText) => {
    const tokens = autoSplitText(rawText.trim())
    const words: LyricWord[] = tokens.map((t) => ({
      id: createPrefixedId('word'),
      text: t,
    }))
    return { id: createPrefixedId('line'), words }
  })
  if (lines.length > 0) store.insertLyricLines(lines)
}

function onAddLyricLine(): void {
  store.insertLyricLines([
    {
      id: createPrefixedId('line'),
      words: [{ id: createPrefixedId('word'), text: '' }],
    },
  ])
}

watch(
  theme,
  (nextTheme) => {
    document.documentElement.setAttribute('data-theme', nextTheme)
    timeline.setTheme(nextTheme)
  },
  { immediate: true },
)

useEditorShortcuts({
  onAction: async (action) => {
    if (action === 'history.undo') {
      store.undo()
    } else if (action === 'history.redo') {
      store.redo()
    } else if (action === 'project.save') {
      await persistence.saveByShortcut()
    } else if (action === 'transport.togglePlay') {
      store.togglePlayback()
    } else if (action === 'timing.tapBpm') {
      store.tapBpm()
    } else if (action === 'metronome.toggle') {
      store.toggleMetronome()
    } else if (action === 'transport.prevBeat') {
      store.seekToPrevBeat(timeline.divisor.value, timeline.effectiveTriplets.value)
    } else if (action === 'transport.nextBeat') {
      store.seekToNextBeat(timeline.divisor.value, timeline.effectiveTriplets.value)
    } else if (action === 'transport.prevBar') {
      store.seekToPreviousBar()
    } else if (action === 'transport.nextBar') {
      store.seekToNextBar()
    } else if (action === 'lyrics.mark') {
      if (editorMode.value === 'lyrics') lyricsEditor.handleMarkKey()
    } else if (action === 'lyrics.markNoAdvance') {
      if (editorMode.value === 'lyrics') lyricsEditor.handleMarkNoAdvanceKey()
    } else if (action === 'lyrics.nextLine') {
      if (editorMode.value === 'lyrics') lyricsEditor.handleNextLineKey()
    } else if (action === 'lyrics.deleteLine') {
      if (editorMode.value === 'lyrics') lyricsEditor.handleDeleteLine()
    } else if (action === 'lyrics.playLineInterval') {
      if (editorMode.value === 'lyrics') lyricsEditor.handlePlayLineInterval()
    } else if (action === 'lyrics.playWordInterval') {
      if (editorMode.value === 'lyrics') lyricsEditor.handlePlayWordInterval()
    }
  },
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <MenuBar
      data-testid="menu-bar"
      :mode="editorMode"
      :theme="theme"
      :can-undo="store.canUndo"
      :can-redo="store.canRedo"
      :next-undo-label="store.nextUndoLabel"
      :next-redo-label="store.nextRedoLabel"
      :project-title="store.project.title"
      :dirty="store.dirty"
      @switchMode="
        (mode) => {
          editorMode = mode
        }
      "
      @toggleTheme="toggleTheme"
      @openProject="requestOpenProject"
      @saveProject="persistence.saveByShortcut"
      @saveProjectAs="persistence.saveAs"
      @updateProjectTitle="store.setProjectTitle"
      @undo="store.undo"
      @redo="store.redo"
      @openAudioFile="openAudioPicker"
      @pasteLyrics="showPasteModal = true"
      @openPreferences="showPreferencesModal = true"
      @importLyricsFile="() => {}"
      @addLyricLine="onAddLyricLine"
    />
    <LyricsPasteModal
      v-if="showPasteModal"
      @confirm="onPasteLyricsConfirm"
      @cancel="showPasteModal = false"
    />
    <UnsavedChangesDialog
      v-if="showUnsavedOpenDialog"
      @saveAndOpen="saveAndOpenProject"
      @discardAndOpen="discardAndOpenProject"
      @cancel="cancelOpenProject"
    />
    <PreferencesModal
      v-if="showPreferencesModal"
      :export-text="localSettings.exportToText()"
      @close="showPreferencesModal = false"
      @exportSettings="onExportSettings"
      @importSettings="onImportSettings"
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
    <!-- Resize handle: dragging adjusts MainView height -->
    <div data-testid="main-view-resize-slot" class="relative h-0 overflow-visible">
      <div
        data-testid="main-view-resize-handle"
        class="absolute -top-0.5 h-1 w-full cursor-row-resize hover:bg-primary/60 active:bg-primary transition-colors"
        @pointerdown="onResizePointerDown"
        @pointermove="onResizePointerMove"
        @pointerup="onResizePointerUp"
      />
    </div>
    <TimingPointsPanel
      v-if="editorMode === 'timing'"
      data-testid="timing-points-panel"
    />
    <LyricsPanel v-else data-testid="lyrics-panel" />
    <StatusBar />
  </div>
</template>
