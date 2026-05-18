<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ShallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'

const { t } = useI18n()

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
  if (e.ctrlKey || e.shiftKey) {
    e.preventDefault()
    e.stopPropagation()
    timeline?.onWheel(e)
  }
  // Plain scroll: let WaveSurfer handle natively (no stopPropagation)
}

// ---- Vertical zoom slider (spectrogram mode) ----
function onVerticalZoomWheel(e: WheelEvent): void {
  e.preventDefault()
  e.stopPropagation()
  const delta = e.deltaY < 0 ? 0.1 : -0.1
  const next = (timeline?.verticalZoom.value ?? 1) + delta
  timeline?.setVerticalZoom(next)
}
</script>

<template>
  <section
    data-testid="main-view-container"
    :style="{ height: `${height}px` }"
    class="relative border-b border-base-300 bg-base-200/30"
  >
    <!-- WaveSurfer mount point -->
    <div
      ref="waveformEl"
      data-testid="waveform-container"
      class="h-full w-full overflow-hidden"
    />

    <!-- Vertical zoom slider — only in spectrogram mode -->
    <div
      v-if="timeline?.viewMode.value === 'spectrogram'"
      data-testid="vertical-zoom-slider"
      class="absolute right-0 top-0 flex h-full w-6 flex-col items-center justify-center bg-base-100/60"
      @wheel.prevent="onVerticalZoomWheel"
    >
      <span class="mb-1 origin-center -rotate-90 text-[9px] text-base-content/60">
        {{ t('transport.verticalZoom') }}
      </span>
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
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
      </div>
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
