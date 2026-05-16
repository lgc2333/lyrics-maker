<script setup lang="ts">
import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()

async function onImportAudio(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await store.importAudioFile(file)
}
</script>

<template>
  <section class="flex items-center gap-2 border-b border-base-300 p-3">
    <!-- Audio import -->
    <input
      type="file"
      accept="audio/*"
      class="file-input file-input-sm"
      @change="onImportAudio"
    />

    <!-- Playback controls -->
    <button class="btn btn-sm" @click="store.togglePlayback()">
      {{ store.isPlaying ? '暂停' : '播放' }}
    </button>

    <!-- Volume controls -->
    <label class="flex items-center gap-1 text-xs">
      音乐
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="store.project.audio.musicVolume"
        class="range range-xs w-20"
        @input="store.setMusicVolume(($event.target as HTMLInputElement).valueAsNumber)"
      />
    </label>
    <label class="flex items-center gap-1 text-xs">
      音效
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="store.project.audio.sfxVolume"
        class="range range-xs w-20"
        @input="store.setSfxVolume(($event.target as HTMLInputElement).valueAsNumber)"
      />
    </label>
  </section>
</template>
