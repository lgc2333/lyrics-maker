<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()

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

function onMusicWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.05 : -0.05
  store.setMusicVolume(
    Math.max(0, Math.min(1, store.project.audio.musicVolume + delta)),
  )
}

function onSfxWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.05 : -0.05
  store.setSfxVolume(Math.max(0, Math.min(1, store.project.audio.sfxVolume + delta)))
}
</script>

<template>
  <section class="flex items-center gap-2 border-b border-base-300 px-3 py-2">
    <!-- 1. Metronome toggle -->
    <button
      data-testid="metronome-toggle"
      class="btn btn-ghost btn-sm btn-square"
      :class="{ 'btn-active text-primary': store.isMetronomeEnabled }"
      :title="store.isMetronomeEnabled ? '关闭节拍器' : '打开节拍器'"
      @click="store.toggleMetronome()"
    >
      <Icon icon="material-symbols:metronome" class="w-5 h-5" />
    </button>

    <!-- 2. Snap toggle placeholder -->
    <button
      data-testid="snap-toggle"
      class="btn btn-ghost btn-sm btn-square"
      title="吸附到节拍"
      disabled
    >
      <Icon icon="material-symbols:magnet-rounded" class="w-5 h-5" />
    </button>

    <!-- 3. Separator -->
    <div class="divider divider-horizontal mx-1" />

    <!-- 4. Previous bar -->
    <button
      data-testid="prev-bar"
      class="btn btn-ghost btn-sm btn-square"
      title="上一小节"
      @click="store.seekToPreviousBar()"
    >
      <Icon icon="material-symbols:skip-previous-rounded" class="w-5 h-5" />
    </button>

    <!-- 5. Play/Pause -->
    <button
      data-testid="play-pause"
      class="btn btn-ghost btn-sm btn-square"
      @click="store.togglePlayback()"
    >
      <Icon
        v-if="store.isPlaying"
        icon="material-symbols:pause-rounded"
        class="w-5 h-5"
      />
      <Icon v-else icon="material-symbols:play-arrow-rounded" class="w-5 h-5" />
    </button>

    <!-- 6. Next bar -->
    <button
      data-testid="next-bar"
      class="btn btn-ghost btn-sm btn-square"
      title="下一小节"
      @click="store.seekToNextBar()"
    >
      <Icon icon="material-symbols:skip-next-rounded" class="w-5 h-5" />
    </button>

    <!-- 7. Current time / Duration -->
    <div class="flex items-center gap-1 mx-2 min-w-[200px]">
      <span data-testid="time-current" class="text-xs tabular-nums">
        {{ formatTime(store.currentTime) }}
      </span>

      <!-- 8. Progress slider -->
      <input
        data-testid="playback-progress"
        type="range"
        min="0"
        :max="store.duration || 0"
        step="0.01"
        :value="store.currentTime"
        class="range range-xs flex-1"
        :disabled="store.duration <= 0"
        @input="onSeek"
      />

      <span data-testid="time-duration" class="text-xs tabular-nums">
        {{ formatTime(store.duration) }}
      </span>
    </div>

    <!-- 9. Music volume popover -->
    <div
      data-testid="music-volume"
      class="group relative inline-flex flex-col items-center"
      @wheel="onMusicWheel"
    >
      <button class="btn btn-ghost btn-sm btn-square" title="音乐音量">
        <Icon icon="material-symbols:music-note-rounded" class="w-5 h-5" />
      </button>
      <div
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center gap-1 bg-base-200 rounded-box p-3 shadow-lg z-50"
      >
        <span class="text-xs tabular-nums font-mono">
          {{ Math.round(store.project.audio.musicVolume * 100) }}%
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="store.project.audio.musicVolume"
          class="range range-xs"
          style="writing-mode: vertical-lr; direction: rtl; height: 80px; width: 20px"
          orient="vertical"
          @input="
            store.setMusicVolume(($event.target as HTMLInputElement).valueAsNumber)
          "
        />
      </div>
    </div>

    <!-- 10. SFX volume popover -->
    <div
      data-testid="sfx-volume"
      class="group relative inline-flex flex-col items-center"
      @wheel="onSfxWheel"
    >
      <button class="btn btn-ghost btn-sm btn-square" title="音效音量">
        <Icon icon="material-symbols:graphic-eq-rounded" class="w-5 h-5" />
      </button>
      <div
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center gap-1 bg-base-200 rounded-box p-3 shadow-lg z-50"
      >
        <span class="text-xs tabular-nums font-mono">
          {{ Math.round(store.project.audio.sfxVolume * 100) }}%
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="store.project.audio.sfxVolume"
          class="range range-xs"
          style="writing-mode: vertical-lr; direction: rtl; height: 80px; width: 20px"
          orient="vertical"
          @input="store.setSfxVolume(($event.target as HTMLInputElement).valueAsNumber)"
        />
      </div>
    </div>
  </section>
</template>
