<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()

const musicPopoverOpen = ref(false)
const sfxPopoverOpen = ref(false)

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.000'
  const totalMs = Math.floor(sec * 1000)
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const milliseconds = totalMs % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

function onSeek(event: Event): void {
  const input = event.target as HTMLInputElement
  store.seekPlayback(input.valueAsNumber)
}

function onMusicWheel(event: WheelEvent): void {
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.05 : -0.05
  store.setMusicVolume(
    Math.max(0, Math.min(1, store.project.audio.musicVolume + delta)),
  )
}

function onSfxWheel(event: WheelEvent): void {
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.05 : -0.05
  store.setSfxVolume(Math.max(0, Math.min(1, store.project.audio.sfxVolume + delta)))
}
</script>

<template>
  <section class="flex items-center gap-2 border-b border-base-300 px-2 py-1.5">
    <button
      data-testid="metronome-toggle"
      class="btn btn-ghost btn-sm btn-square"
      :class="{ 'btn-active text-primary': store.isMetronomeEnabled }"
      title="节拍器"
      @click="store.toggleMetronome()"
    >
      <Icon icon="lucide:metronome" class="h-5 w-5" />
    </button>

    <button
      data-testid="snap-toggle"
      class="btn btn-ghost btn-sm btn-square"
      title="吸附"
      disabled
    >
      <Icon icon="mynaui:magnet" class="h-5 w-5" />
    </button>

    <div class="mx-1 h-5 w-px bg-base-300" />

    <button
      data-testid="prev-bar"
      class="btn btn-ghost btn-sm btn-square"
      title="上一小节"
      @click="store.seekToPreviousBar()"
    >
      <Icon icon="material-symbols:skip-previous-rounded" class="h-5 w-5" />
    </button>

    <button
      data-testid="play-pause"
      class="btn btn-ghost btn-sm btn-square"
      title="播放/暂停"
      @click="store.togglePlayback()"
    >
      <Icon
        v-if="store.isPlaying"
        icon="material-symbols:pause-rounded"
        class="h-5 w-5"
      />
      <Icon v-else icon="material-symbols:play-arrow-rounded" class="h-5 w-5" />
    </button>

    <button
      data-testid="next-bar"
      class="btn btn-ghost btn-sm btn-square"
      title="下一小节"
      @click="store.seekToNextBar()"
    >
      <Icon icon="material-symbols:skip-next-rounded" class="h-5 w-5" />
    </button>

    <span data-testid="time-display" class="text-xs tabular-nums">
      {{ formatTime(store.currentTime) }} / {{ formatTime(store.duration) }}
    </span>

    <input
      data-testid="playback-progress"
      type="range"
      min="0"
      :max="store.duration || 0"
      step="0.001"
      :value="store.currentTime"
      class="range range-xs flex-1"
      :disabled="store.duration <= 0"
      @input="onSeek"
    />

    <div
      data-testid="music-volume"
      class="relative"
      @mouseenter="musicPopoverOpen = true"
      @mouseleave="musicPopoverOpen = false"
      @wheel="onMusicWheel"
    >
      <button class="btn btn-ghost btn-sm btn-square" title="音乐音量">
        <Icon icon="material-symbols:music-note-rounded" class="h-5 w-5" />
      </button>
      <div
        v-show="musicPopoverOpen"
        class="absolute bottom-full left-1/2 z-50 mb-0 -translate-x-1/2 rounded-md border border-base-300 bg-base-100 px-2 py-2 shadow-lg"
      >
        <div class="mb-1 text-center text-[10px] tabular-nums">
          {{ Math.round(store.project.audio.musicVolume * 100) }}%
        </div>
        <input
          class="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="store.project.audio.musicVolume"
          @input="
            store.setMusicVolume(($event.target as HTMLInputElement).valueAsNumber)
          "
        />
      </div>
    </div>

    <div
      data-testid="sfx-volume"
      class="relative"
      @mouseenter="sfxPopoverOpen = true"
      @mouseleave="sfxPopoverOpen = false"
      @wheel="onSfxWheel"
    >
      <button class="btn btn-ghost btn-sm btn-square" title="音效音量">
        <Icon icon="material-symbols:graphic-eq-rounded" class="h-5 w-5" />
      </button>
      <div
        v-show="sfxPopoverOpen"
        class="absolute bottom-full left-1/2 z-50 mb-0 -translate-x-1/2 rounded-md border border-base-300 bg-base-100 px-2 py-2 shadow-lg"
      >
        <div class="mb-1 text-center text-[10px] tabular-nums">
          {{ Math.round(store.project.audio.sfxVolume * 100) }}%
        </div>
        <input
          class="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="store.project.audio.sfxVolume"
          @input="store.setSfxVolume(($event.target as HTMLInputElement).valueAsNumber)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.volume-slider {
  width: 84px;
  transform: rotate(-90deg);
  transform-origin: center;
}
</style>
