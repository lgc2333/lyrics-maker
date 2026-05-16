<script setup lang="ts">
import { useEditorShortcuts } from '../../composables/useEditorShortcuts'
import { useProjectPersistence } from '../../composables/useProjectPersistence'
import { useEditorStore } from '../../stores/editor-store'
import MainView from './MainView.vue'
import MenuBar from './MenuBar.vue'
import ModePanel from './ModePanel.vue'
import TransportBar from './TransportBar.vue'

const store = useEditorStore()
const persistence = useProjectPersistence()

useEditorShortcuts({
  onAction: async (action) => {
    if (action === 'history.undo') store.undo()
    if (action === 'history.redo') store.redo()
    if (action === 'project.save') await persistence.saveByShortcut()
  },
})
</script>

<template>
  <div class="flex h-screen flex-col">
    <MenuBar data-testid="menu-bar" />
    <TransportBar data-testid="transport-bar" />
    <MainView data-testid="main-view" />
    <ModePanel data-testid="mode-panel" />
  </div>
</template>
