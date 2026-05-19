<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ShallowRef } from 'vue'

import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'

// Injected from AppShell
const timeline = inject(TIMELINE_VIEW_KEY)
const timelineContainerRef =
  inject<ShallowRef<HTMLElement | null>>('timelineContainerRef')

// ---- Resize handle ----
const height = ref(250)
const min = 180
const max = 520

let dragging = false
let startY = 0
let startHeight = 0

function onPointerDown(e: PointerEvent) {
  dragging = true
  startY = e.clientY
  startHeight = height.value
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  const delta = e.clientY - startY
  height.value = Math.max(min, Math.min(max, startHeight + delta))
}

function onPointerUp() {
  dragging = false
}

// ---- WaveSurfer container ref ----
const waveformEl = ref<HTMLElement | null>(null)

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)

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
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
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
    :style="{ height: `${height}px` }"
    class="relative border-b border-base-300 bg-base-200/30"
  >
    <!-- WaveSurfer mount point — position:relative needed for absolute canvas overlay -->
    <div
      ref="waveformEl"
      data-testid="waveform-container"
      class="relative h-full w-full"
    />

    <!-- Loading spinner — shown while WaveSurfer is decoding audio or computing spectrogram -->
    <div
      v-if="timeline?.isLoading.value"
      data-testid="waveform-loading"
      class="absolute inset-0 z-10 flex items-center justify-center bg-base-200/50"
    >
      <span class="loading loading-spinner loading-md text-primary" />
    </div>

    <!-- Phase 4 placeholder: WordTimelineBar will be mounted here -->
    <div data-testid="word-timeline-bar-slot" class="hidden" />

    <!-- Resize handle -->
    <div
      data-testid="main-view-resize-handle"
      class="absolute inset-x-0 bottom-0 h-2 cursor-row-resize"
      @pointerdown="onPointerDown"
    />
  </section>
</template>
