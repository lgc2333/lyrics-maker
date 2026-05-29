<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'
import { formatTimestamp } from '../../core/utils/format-timestamp'
import { useEditorStore } from '../../stores/editor-store'
import VerticalSliderPopover from './VerticalSliderPopover.vue'

const { t } = useI18n()

const store = useEditorStore()

const timeline = inject(TIMELINE_VIEW_KEY)

const SUBDIVISION_OPTIONS = [1, 2, 4, 8, 16] as const

function onSeek(event: Event): void {
  const input = event.target as HTMLInputElement
  store.seekPlayback(input.valueAsNumber)
}

function setVerticalZoom(value: number): void {
  if (!timeline || timeline.viewMode.value !== 'spectrogram') return
  timeline.setVerticalZoom(value)
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

function onViewModeToggle(): void {
  if (!timeline) return
  const nextMode = timeline.viewMode.value === 'waveform' ? 'spectrogram' : 'waveform'
  timeline.setViewMode(nextMode)
  store.showStatus('status.settings.viewMode', { mode: nextMode })
}

function onAutoFollowToggle(): void {
  if (!timeline) return
  const enabled = !timeline.autoFollowPlayback.value
  timeline.setAutoFollowPlayback(enabled)
  store.showStatus('status.settings.autoFollowPlayback', {
    state: enabled ? '开启' : '关闭',
  })
}

function onGridVisibilityToggle(): void {
  store.setGridVisible(!store.gridVisible)
}
</script>

<template>
  <section class="flex items-center gap-2 border-b border-base-300 px-2 py-1.5">
    <!-- Waveform / Spectrogram toggle; hover shows vertical zoom popover in spectrogram mode -->
    <VerticalSliderPopover
      v-if="timeline"
      data-testid="view-mode-control"
      button-testid="view-mode-toggle"
      panel-testid="vertical-zoom-slider"
      :model-value="timeline.verticalZoom.value"
      :label="t('transport.toggleViewMode')"
      :min="0.5"
      :max="10"
      :slider-step="0.1"
      :wheel-step="0.1"
      :popover-enabled="timeline.viewMode.value === 'spectrogram'"
      @click="onViewModeToggle"
      @update:model-value="setVerticalZoom"
    >
      <template #icon>
        <Icon
          v-if="timeline.viewMode.value === 'waveform'"
          icon="material-symbols:graphic-eq-rounded"
          class="h-5 w-5"
        />
        <Icon v-else icon="mynaui:chart-area-solid" class="h-5 w-5" />
      </template>
    </VerticalSliderPopover>

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
      v-if="timeline"
      data-testid="auto-follow-toggle"
      class="btn btn-ghost btn-sm btn-square"
      :class="{ 'btn-active text-primary': timeline.autoFollowPlayback.value }"
      :title="t('transport.autoFollowPlayback')"
      @click="onAutoFollowToggle"
    >
      <Icon icon="material-symbols:filter-center-focus-rounded" class="h-5 w-5" />
    </button>

    <div class="h-5 w-px bg-base-300" />
    <button
      v-if="timeline"
      data-testid="grid-visibility-toggle"
      class="btn btn-ghost btn-sm btn-square"
      :class="{ 'btn-active text-primary': store.gridVisible }"
      :title="t('transport.gridVisible')"
      @click="onGridVisibilityToggle"
    >
      <Icon
        :icon="store.gridVisible ? 'hugeicons:grid' : 'hugeicons:grid-off'"
        class="h-5 w-5"
      />
    </button>

    <button
      data-testid="snap-toggle"
      class="btn btn-ghost btn-sm btn-square"
      :class="{ 'btn-active text-primary': store.snapEnabled }"
      :title="t('transport.snap')"
      @click="store.setSnapEnabled(!store.snapEnabled)"
    >
      <Icon icon="mynaui:magnet" class="h-5 w-5" />
    </button>

    <!-- Rhythm mode toggle -->
    <button
      v-if="timeline"
      data-testid="rhythm-mode-toggle"
      class="btn btn-sm btn-square"
      :class="timeline.altTripletActive.value ? 'btn-active text-warning' : 'btn-ghost'"
      :disabled="timeline.altTripletActive.value"
      :title="t('transport.rhythmMode')"
      @click="toggleRhythmMode"
    >
      <Icon
        v-if="timeline.altTripletActive.value || timeline.effectiveTriplets.value"
        icon="mynaui:three-square"
        class="h-5 w-5"
      />
      <Icon v-else icon="mynaui:four-square" class="h-5 w-5" />
    </button>

    <!-- Subdivision divisor stepper -->
    <div
      v-if="timeline"
      data-testid="subdivision-stepper"
      class="join items-center"
      :title="t('transport.subdivisionDivisor')"
    >
      <button
        data-testid="subdivision-decrease"
        class="btn btn-sm btn-square join-item btn-ghost"
        :disabled="timeline.divisor.value === 1"
        @click="stepSubdivision(-1)"
      >
        <Icon icon="material-symbols:remove-rounded" class="h-5 w-5" />
      </button>
      <div
        data-testid="subdivision-value"
        class="join-item min-w-8 text-sm tabular-nums text-center"
      >
        {{ timeline.divisor.value }}<span class="text-xs">x</span>
      </div>
      <button
        data-testid="subdivision-increase"
        class="btn btn-sm btn-square join-item btn-ghost"
        :disabled="timeline.divisor.value === 16"
        @click="stepSubdivision(1)"
      >
        <Icon icon="material-symbols:add-rounded" class="h-5 w-5" />
      </button>
    </div>

    <div class="h-5 w-px bg-base-300" />

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

    <div
      data-testid="playback-rate-stepper"
      class="join items-center"
      :title="t('transport.playbackRate')"
    >
      <button
        data-testid="playback-rate-decrease"
        class="btn btn-sm btn-square join-item btn-ghost"
        :disabled="!store.canDecreasePlaybackRate"
        @click="store.decreasePlaybackRate()"
      >
        <Icon icon="material-symbols:remove-rounded" class="h-5 w-5" />
      </button>
      <div
        data-testid="playback-rate-value"
        class="join-item min-w-12 text-sm tabular-nums text-center"
      >
        {{ Math.round(store.playbackRate * 100) }}%
      </div>
      <button
        data-testid="playback-rate-increase"
        class="btn btn-sm btn-square join-item btn-ghost"
        :disabled="!store.canIncreasePlaybackRate"
        @click="store.increasePlaybackRate()"
      >
        <Icon icon="material-symbols:add-rounded" class="h-5 w-5" />
      </button>
    </div>

    <VerticalSliderPopover
      data-testid="music-volume"
      button-testid="music-volume-button"
      :model-value="store.musicVolume"
      :label="t('transport.musicVolume')"
      @update:model-value="store.setMusicVolume"
      @click="store.toggleMusicMuted()"
    >
      <template #icon>
        <Icon
          :icon="
            store.musicMuted || store.musicVolume === 0
              ? 'material-symbols:music-off-rounded'
              : 'material-symbols:music-note-rounded'
          "
          class="h-5 w-5"
        />
      </template>
    </VerticalSliderPopover>

    <VerticalSliderPopover
      data-testid="sfx-volume"
      button-testid="sfx-volume-button"
      :model-value="store.sfxVolume"
      :label="t('transport.sfxVolume')"
      @update:model-value="store.setSfxVolume"
      @click="store.toggleSfxMuted()"
    >
      <template #icon>
        <Icon
          :icon="
            store.sfxMuted || store.sfxVolume === 0
              ? 'material-symbols:volume-off-outline-rounded'
              : 'material-symbols:volume-up-outline-rounded'
          "
          class="h-5 w-5"
        />
      </template>
    </VerticalSliderPopover>
  </section>
</template>
