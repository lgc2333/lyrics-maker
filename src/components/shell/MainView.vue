<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Ref, ShallowRef } from 'vue'

import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'

// Injected from AppShell
const timeline = inject(TIMELINE_VIEW_KEY)
const timelineContainerRef =
  inject<ShallowRef<HTMLElement | null>>('timelineContainerRef')
const mainViewHeight = inject<Ref<number>>('mainViewHeight')

// ---- WaveSurfer container ref ----
const waveformEl = ref<HTMLElement | null>(null)

onMounted(() => {
  // Register container with AppShell's useTimelineView
  if (timelineContainerRef && waveformEl.value) {
    timelineContainerRef.value = waveformEl.value
  }

  // Wheel handler: intercept Ctrl/Shift combinations before WaveSurfer sees them
  waveformEl.value?.addEventListener('wheel', onWheel, {
    passive: false,
    capture: true,
  })
})

onBeforeUnmount(() => {
  waveformEl.value?.removeEventListener('wheel', onWheel, { capture: true })

  // Unregister from parent
  if (timelineContainerRef) timelineContainerRef.value = null
})

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  e.stopPropagation()
  timeline?.onWheel(e)
}
</script>

<template>
  <section
    data-testid="main-view-container"
    :style="{ height: `${mainViewHeight ?? 250}px` }"
    class="relative bg-base-200/30"
  >
    <!-- WaveSurfer mount point — position:relative needed for absolute canvas overlay -->
    <div
      ref="waveformEl"
      data-testid="waveform-container"
      :class="{ 'bg-black': timeline?.viewMode.value === 'spectrogram' }"
      class="relative h-full w-full"
    />

    <!-- Loading spinner — shown while WaveSurfer is decoding audio or computing spectrogram -->
    <div
      v-if="timeline?.isLoading.value"
      data-testid="waveform-loading"
      role="status"
      aria-live="polite"
      aria-label="Loading waveform"
      class="absolute inset-0 z-10 flex items-center justify-center bg-base-200/50"
    >
      <span class="loading loading-spinner loading-md text-primary" />
    </div>

    <!-- Phase 4 placeholder: WordTimelineBar will be mounted here -->
    <div data-testid="word-timeline-bar-slot" class="hidden" />
  </section>
</template>
