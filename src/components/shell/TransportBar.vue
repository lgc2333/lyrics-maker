<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'
import { formatTimestamp } from '../../core/utils/format-timestamp'
import { useEditorStore } from '../../stores/editor-store'
import VolumePopover from './VolumePopover.vue'

const { t } = useI18n()

const store = useEditorStore()

const timeline = inject(TIMELINE_VIEW_KEY)

const SUBDIVISION_OPTIONS = [1, 2, 4, 8, 16] as const

const verticalZoomPopoverOpen = ref(false)

function onSeek(event: Event): void {
  const input = event.target as HTMLInputElement
  store.seekPlayback(input.valueAsNumber)
}

function onVerticalZoomWheel(event: WheelEvent): void {
  if (!timeline || timeline.viewMode.value !== 'spectrogram') return
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.1 : -0.1
  timeline.setVerticalZoom((timeline.verticalZoom.value ?? 1) + delta)
}

function stepSubdivision(direction: -1 | 1): void {
  if (!timeline) return
  const index = SUBDIVISION_OPTIONS.indexOf(timeline.divisor.value)
  const nextIndex = Math.max(
    0,
    Math.min(SUBDIVISION_OPTIONS.length - 1, index + direction),
  )
  timeline.divisor.value = SUBDIVISION_OPTIONS[nextIndex]
}

function toggleRhythmMode(): void {
  if (!timeline || timeline.altTripletActive.value) return
  timeline.rhythmMode.value =
    timeline.rhythmMode.value === 'triplets' ? 'common' : 'triplets'
}
</script>

<template>
  <section class="flex items-center gap-2 border-b border-base-300 px-2 py-1.5">
    <!-- Waveform / Spectrogram toggle; hover shows vertical zoom popover in spectrogram mode -->
    <div
      v-if="timeline"
      class="relative"
      @mouseenter="verticalZoomPopoverOpen = timeline.viewMode.value === 'spectrogram'"
      @mouseleave="verticalZoomPopoverOpen = false"
      @wheel="onVerticalZoomWheel"
    >
      <button
        data-testid="view-mode-toggle"
        class="btn btn-ghost btn-sm btn-square"
        :title="t('transport.toggleViewMode')"
        @click="
          timeline.setViewMode(
            timeline.viewMode.value === 'waveform' ? 'spectrogram' : 'waveform',
          )
        "
      >
        <Icon
          v-if="timeline.viewMode.value === 'waveform'"
          icon="material-symbols:graphic-eq-rounded"
          class="h-5 w-5"
        />
        <Icon v-else icon="mynaui:chart-area-solid" class="h-5 w-5" />
      </button>

      <!-- Vertical zoom popover — spectrogram mode only, appears above the toggle button -->
      <div
        v-if="timeline.viewMode.value === 'spectrogram'"
        v-show="verticalZoomPopoverOpen"
        data-testid="vertical-zoom-slider"
        class="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded-md border border-base-300 bg-base-100 px-2 py-2 shadow-lg"
      >
        <div class="mb-1 text-center text-[10px] tabular-nums">
          {{ Math.round((timeline?.verticalZoom.value ?? 1) * 100) }}%
        </div>
        <div class="relative h-24 w-6">
          <input
            class="range range-xs absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-90"
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            :value="timeline?.verticalZoom.value ?? 1"
            @input="
              timeline?.setVerticalZoom(
                ($event.target as HTMLInputElement).valueAsNumber,
              )
            "
          />
        </div>
      </div>
    </div>

    <button
      data-testid="metronome-toggle"
      class="btn btn-ghost btn-sm btn-square"
      :class="{ 'btn-active text-primary': store.isMetronomeEnabled }"
      :title="t('transport.metronome')"
      @click="store.toggleMetronome()"
    >
      <Icon icon="lucide:metronome" class="h-5 w-5" />
    </button>

    <button
      data-testid="snap-toggle"
      class="btn btn-ghost btn-sm btn-square"
      :class="{ 'btn-active text-primary': store.project.settings.snapEnabled }"
      :title="t('transport.snap')"
      @click="store.setSnapEnabled(!store.project.settings.snapEnabled)"
    >
      <Icon icon="mynaui:magnet" class="h-5 w-5" />
    </button>

    <!-- Subdivision divisor stepper -->
    <div
      v-if="timeline"
      data-testid="subdivision-stepper"
      class="join"
      :title="t('transport.subdivisionDivisor')"
    >
      <button
        data-testid="subdivision-decrease"
        class="btn btn-xs join-item btn-ghost"
        :disabled="timeline.divisor.value === 1"
        @click="stepSubdivision(-1)"
      >
        <Icon icon="material-symbols:remove-rounded" class="h-4 w-4" />
      </button>
      <div
        data-testid="subdivision-value"
        class="join-item flex h-6 min-w-9 items-center justify-center border border-base-300 px-2 text-[11px] tabular-nums"
      >
        {{ timeline.divisor.value }}x
      </div>
      <button
        data-testid="subdivision-increase"
        class="btn btn-xs join-item btn-ghost"
        :disabled="timeline.divisor.value === 16"
        @click="stepSubdivision(1)"
      >
        <Icon icon="material-symbols:add-rounded" class="h-4 w-4" />
      </button>
    </div>

    <!-- Rhythm mode toggle -->
    <button
      v-if="timeline"
      data-testid="rhythm-mode-toggle"
      class="btn btn-xs btn-square"
      :class="
        timeline.altTripletActive.value
          ? 'btn-active btn-warning text-warning-content'
          : timeline.effectiveTriplets.value
            ? 'btn-active'
            : 'btn-ghost'
      "
      :disabled="timeline.altTripletActive.value"
      :title="t('transport.rhythmMode')"
      @click="toggleRhythmMode"
    >
      <Icon
        v-if="timeline.altTripletActive.value"
        icon="lucide:keyboard"
        class="h-4 w-4"
      />
      <Icon
        v-else-if="timeline.effectiveTriplets.value"
        icon="lucide:triangle"
        class="h-4 w-4"
      />
      <Icon v-else icon="lucide:music" class="h-4 w-4" />
    </button>

    <div class="mx-1 h-5 w-px bg-base-300" />

    <button
      data-testid="prev-bar"
      class="btn btn-ghost btn-sm btn-square"
      :title="t('transport.prevBar')"
      @click="store.seekToPreviousBar()"
    >
      <Icon icon="material-symbols:skip-previous-rounded" class="h-5 w-5" />
    </button>

    <button
      data-testid="play-pause"
      class="btn btn-ghost btn-sm btn-square"
      :title="t('transport.playPause')"
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
      :title="t('transport.nextBar')"
      @click="store.seekToNextBar()"
    >
      <Icon icon="material-symbols:skip-next-rounded" class="h-5 w-5" />
    </button>

    <span data-testid="time-display" class="text-xs tabular-nums">
      {{ formatTimestamp(store.currentTime) }} / {{ formatTimestamp(store.duration) }}
    </span>

    <input
      data-testid="playback-progress"
      type="range"
      min="0"
      :max="store.duration || 1"
      step="0.001"
      :value="store.currentTime"
      class="range range-xs flex-1"
      @input="onSeek"
    />

    <VolumePopover
      data-testid="music-volume"
      :volume="store.project.audio.musicVolume"
      icon="material-symbols:music-note-rounded"
      :label="t('transport.musicVolume')"
      @update:volume="store.setMusicVolume"
    />

    <VolumePopover
      data-testid="sfx-volume"
      :volume="store.project.audio.sfxVolume"
      icon="material-symbols:graphic-eq-rounded"
      :label="t('transport.sfxVolume')"
      @update:volume="store.setSfxVolume"
    />
  </section>
</template>
