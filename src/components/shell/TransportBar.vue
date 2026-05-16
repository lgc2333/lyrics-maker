<script setup lang="ts">
import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()

async function onImportAudio(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await store.importAudioFile(file)
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00'
  const total = Math.floor(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function onSeek(event: Event) {
  const input = event.target as HTMLInputElement
  store.seekPlayback(input.valueAsNumber)
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

    <!-- Playback progress -->
    <div class="flex items-center gap-2 min-w-[320px]">
      <span class="text-xs tabular-nums">{{ formatTime(store.currentTime) }}</span>
      <input
        data-testid="playback-progress"
        type="range"
        min="0"
        :max="store.duration || 0"
        step="0.01"
        :value="store.currentTime"
        class="range range-xs w-56"
        :disabled="store.duration <= 0"
        @input="onSeek"
      />
      <span class="text-xs tabular-nums">{{ formatTime(store.duration) }}</span>
    </div>

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
