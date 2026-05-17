<script setup lang="ts">
import { ref } from 'vue'

import { useEditorShortcuts } from '../../composables/useEditorShortcuts'
import { useProjectPersistence } from '../../composables/useProjectPersistence'
import { useEditorStore } from '../../stores/editor-store'
import LyricsPanel from './LyricsPanel.vue'
import MainView from './MainView.vue'
import MenuBar from './MenuBar.vue'
import TimingPointsPanel from './TimingPointsPanel.vue'
import TransportBar from './TransportBar.vue'

const store = useEditorStore()
const persistence = useProjectPersistence()

const editorMode = ref<'timing' | 'lyrics'>('timing')

useEditorShortcuts({
  onAction: async (action) => {
    if (action === 'history.undo') store.undo()
    else if (action === 'history.redo') store.redo()
    else if (action === 'project.save') await persistence.saveByShortcut()
    else if (action === 'transport.togglePlay') store.togglePlayback()
    else if (action === 'timing.tapBpm') store.tapBpm()
    else if (action === 'metronome.toggle') store.toggleMetronome()
  },
})
</script>

<template>
  <div class="flex h-screen flex-col">
    <MenuBar
      data-testid="menu-bar"
      :mode="editorMode"
      @switchMode="editorMode = $event"
    />
    <TransportBar data-testid="transport-bar" />
    <MainView data-testid="main-view" />
    <TimingPointsPanel
      v-if="editorMode === 'timing'"
      data-testid="timing-points-panel"
    />
    <LyricsPanel v-else data-testid="lyrics-panel" />
  </div>
</template>
