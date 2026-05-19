<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { getActiveTimingPoint } from '../../core/timing/timing-engine'
import { useEditorStore } from '../../stores/editor-store'
import TimingPointControls from './TimingPointControls.vue'
import TimingPointList from './TimingPointList.vue'

const store = useEditorStore()
const selectedId = ref<string | null>(null)

const activePoint = computed(() => {
  const points = store.project.timingPoints
  if (points.length === 0) return null
  return getActiveTimingPoint(points, store.currentTime)
})

const selectedPoint = computed(
  () => store.project.timingPoints.find((p) => p.id === selectedId.value) ?? null,
)

const focusedPoint = computed(() => selectedPoint.value ?? activePoint.value)

watch(
  () => store.project.timingPoints,
  (points) => {
    if (selectedId.value && !points.some((p) => p.id === selectedId.value)) {
      selectedId.value = null
    }
  },
  { deep: true },
)

function adjustPointTime(deltaMs: number): void {
  if (!focusedPoint.value) return
  store.updateTimingPoint(focusedPoint.value.id, {
    time: Math.max(0, focusedPoint.value.time + deltaMs / 1000),
  })
}

function setOffsetToCurrentTime(): void {
  if (!focusedPoint.value) return
  store.updateTimingPoint(focusedPoint.value.id, { time: store.currentTime })
}

function setOffsetFromSeconds(seconds: number): void {
  if (!focusedPoint.value || !Number.isFinite(seconds)) return
  store.updateTimingPoint(focusedPoint.value.id, { time: Math.max(0, seconds) })
}

function adjustBpm(delta: number): void {
  if (!focusedPoint.value) return
  store.updateTimingPoint(focusedPoint.value.id, {
    bpm: Math.max(1, Number((focusedPoint.value.bpm + delta).toFixed(3))),
  })
}

function setBpmFromInput(bpm: number): void {
  if (!focusedPoint.value || !Number.isFinite(bpm)) return
  store.updateTimingPoint(focusedPoint.value.id, { bpm: Math.max(1, bpm) })
}

function updateTimeSignatureNumerator(value: number): void {
  if (!focusedPoint.value || !Number.isFinite(value)) return
  store.updateTimingPoint(focusedPoint.value.id, {
    timeSignatureNumerator: Math.max(1, Math.floor(value)),
  })
}

function updateTimeSignatureDenominator(value: number): void {
  if (!focusedPoint.value || !Number.isFinite(value)) return
  store.updateTimingPoint(focusedPoint.value.id, {
    timeSignatureDenominator: Math.max(1, Math.floor(value)),
  })
}

function addPointAtCurrentTime(): void {
  const source = focusedPoint.value ?? activePoint.value
  store.addTimingPoint({
    time: store.currentTime,
    bpm: source?.bpm ?? 120,
    timeSignatureNumerator: source?.timeSignatureNumerator ?? 4,
    timeSignatureDenominator: source?.timeSignatureDenominator ?? 4,
  })
}

function cloneSelectedPointAtCurrentTime(): void {
  if (!selectedPoint.value) return
  store.addTimingPoint({
    time: store.currentTime,
    bpm: selectedPoint.value.bpm,
    timeSignatureNumerator: selectedPoint.value.timeSignatureNumerator,
    timeSignatureDenominator: selectedPoint.value.timeSignatureDenominator,
  })
}
</script>

<template>
  <section
    data-testid="timing-points-panel"
    class="flex flex-1 overflow-hidden border-t border-base-300"
  >
    <TimingPointList
      :selected-id="selectedId"
      @select="selectedId = $event"
      @remove="store.removeTimingPoint($event)"
      @clone-selected="cloneSelectedPointAtCurrentTime"
      @add-at-current-time="addPointAtCurrentTime"
    />
    <TimingPointControls
      :focused-point="focusedPoint"
      :active-point="activePoint"
      @adjust-time="adjustPointTime"
      @set-offset-to-current-time="setOffsetToCurrentTime"
      @set-offset="setOffsetFromSeconds"
      @adjust-bpm="adjustBpm"
      @set-bpm="setBpmFromInput"
      @update-numerator="updateTimeSignatureNumerator"
      @update-denominator="updateTimeSignatureDenominator"
      @tap-bpm="store.tapBpm()"
    />
  </section>
</template>
