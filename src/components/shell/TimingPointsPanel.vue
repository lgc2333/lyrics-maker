<script setup lang="ts">
import { computed, ref } from 'vue'

import { getActiveTimingPoint } from '../../core/timing/timing-engine'
import { useEditorStore } from '../../stores/editor-store'

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

const activeId = computed(() => activePoint.value?.id ?? null)

function isSelected(id: string): boolean {
  return selectedId.value === id
}

function isActive(id: string): boolean {
  return activeId.value === id
}

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

/** Format seconds as MM:SS.mmm */
function formatPointTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.000'
  const totalMs = Math.round(sec * 1000)
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const milliseconds = totalMs % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

/** Label for the Tap BPM button based on tap state */
const TAP_MIN_SAMPLES = 9 // estimator needs > 8 taps

const tapBpmLabel = computed(() => {
  const count = store.tapCount
  const bpm = store.tapEstimatedBpm
  if (count === 0) return 'Tap to get BPM! (B)'
  if (bpm === null) {
    const remaining = TAP_MIN_SAMPLES - count
    return `Tap${'.'.repeat(Math.max(1, remaining))}`
  }
  return `${bpm.toFixed(1)} BPM / ${count} Taps`
})

const tapBpmClass = computed(() => {
  const count = store.tapCount
  if (count === 0) return 'btn btn-sm w-full mb-2'
  if (store.tapEstimatedBpm === null) return 'btn btn-sm w-full mb-2 btn-warning'
  return 'btn btn-sm w-full mb-2 btn-success'
})

async function onTapBpm(): Promise<void> {
  await store.tapBpm()
}
</script>

<template>
  <section
    data-testid="timing-points-panel"
    class="flex flex-1 overflow-hidden border-t border-base-300"
  >
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center border-b border-base-300 px-3 py-1.5 text-xs">
        <span class="opacity-70">Timing Points</span>
        <div class="ml-auto flex items-center gap-2">
          <button
            data-testid="clone-selected-point-at-current-time"
            class="btn btn-xs"
            :disabled="!selectedPoint"
            @click="cloneSelectedPointAtCurrentTime"
          >
            克隆选中时轴到此处
          </button>
          <button
            data-testid="add-point-at-current-time"
            class="btn btn-xs"
            @click="addPointAtCurrentTime"
          >
            在此处添加时轴
          </button>
        </div>
      </header>

      <ul class="min-h-0 flex-1 overflow-auto">
        <li
          v-for="point in store.project.timingPoints"
          :key="point.id"
          data-testid="timing-point-row"
          class="relative flex cursor-pointer items-center gap-3 border-b border-base-200 px-3 py-2 text-sm transition-colors hover:bg-base-200/80"
          :class="{
            'is-selected': isSelected(point.id),
            'is-active': isActive(point.id),
            'is-selected-active': isSelected(point.id) && isActive(point.id),
          }"
          @click="selectedId = point.id"
        >
          <span class="w-24 tabular-nums">{{ formatPointTime(point.time) }}</span>
          <span class="w-20 tabular-nums">{{ point.bpm.toFixed(1) }} BPM</span>
          <span class="w-20 tabular-nums"
            >{{ point.timeSignatureNumerator }}/{{
              point.timeSignatureDenominator
            }}</span
          >
          <button
            class="btn btn-xs btn-ghost ml-auto"
            @click.stop="store.removeTimingPoint(point.id)"
          >
            删除
          </button>
        </li>
      </ul>
    </div>

    <aside
      class="w-[320px] shrink-0 border-l border-base-300 bg-base-100 text-sm"
      data-testid="timing-right-panel"
    >
      <div class="border-b border-base-300 px-3 py-2">
        <div class="flex items-center justify-between">
          <span>Offset</span>
          <div class="flex items-center gap-1">
            <input
              class="input input-xs w-24 text-right tabular-nums"
              type="number"
              step="0.001"
              :value="(focusedPoint?.time ?? store.currentTime).toFixed(3)"
              @change="
                setOffsetFromSeconds(Number(($event.target as HTMLInputElement).value))
              "
            />
            <span class="text-xs opacity-50">s</span>
          </div>
        </div>
        <button
          data-testid="set-offset-to-current-time"
          class="btn btn-sm w-full mt-2"
          @click="setOffsetToCurrentTime"
        >
          Set offset to current time
        </button>
        <div class="mt-2 flex items-center justify-center gap-1">
          <button
            data-testid="offset-minus-10"
            class="btn btn-xs"
            @click="adjustPointTime(-10)"
          >
            10
          </button>
          <button
            data-testid="offset-minus-5"
            class="btn btn-xs"
            @click="adjustPointTime(-5)"
          >
            5
          </button>
          <button
            data-testid="offset-minus-2"
            class="btn btn-xs"
            @click="adjustPointTime(-2)"
          >
            2
          </button>
          <button
            data-testid="offset-minus-1"
            class="btn btn-xs"
            @click="adjustPointTime(-1)"
          >
            1
          </button>
          <span class="text-xs opacity-50">-</span>
          <span class="text-xs opacity-50">(ms)</span>
          <span class="text-xs opacity-50">+</span>
          <button
            data-testid="offset-plus-1"
            class="btn btn-xs"
            @click="adjustPointTime(1)"
          >
            1
          </button>
          <button
            data-testid="offset-plus-2"
            class="btn btn-xs"
            @click="adjustPointTime(2)"
          >
            2
          </button>
          <button
            data-testid="offset-plus-5"
            class="btn btn-xs"
            @click="adjustPointTime(5)"
          >
            5
          </button>
          <button
            data-testid="offset-plus-10"
            class="btn btn-xs"
            @click="adjustPointTime(10)"
          >
            10
          </button>
        </div>
      </div>

      <div class="border-b border-base-300 px-3 py-2">
        <div class="mb-2 flex items-center justify-between">
          <span>BPM</span>
          <input
            class="input input-xs w-26 text-right tabular-nums"
            type="number"
            step="0.1"
            min="1"
            :value="(focusedPoint?.bpm ?? activePoint?.bpm ?? 120).toFixed(1)"
            @change="setBpmFromInput(Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <button
          data-testid="tap-bpm-button"
          :class="tapBpmClass"
          :disabled="store.duration <= 0"
          @click="onTapBpm"
        >
          {{ tapBpmLabel }}
        </button>
        <div class="flex items-center justify-center gap-1">
          <button class="btn btn-xs" @click="adjustBpm(-1)">1</button>
          <button class="btn btn-xs" @click="adjustBpm(-0.5)">.5</button>
          <button class="btn btn-xs" @click="adjustBpm(-0.2)">.2</button>
          <button class="btn btn-xs" @click="adjustBpm(-0.1)">.1</button>
          <span class="text-xs opacity-50">-</span>
          <span class="text-xs opacity-50">|</span>
          <span class="text-xs opacity-50">+</span>
          <button class="btn btn-xs" @click="adjustBpm(0.1)">.1</button>
          <button class="btn btn-xs" @click="adjustBpm(0.2)">.2</button>
          <button class="btn btn-xs" @click="adjustBpm(0.5)">.5</button>
          <button class="btn btn-xs" @click="adjustBpm(1)">1</button>
        </div>
      </div>

      <div class="px-3 py-2">
        <div class="mb-1 flex items-center justify-between">
          <span>拍号</span>
          <div class="flex items-center gap-2">
            <input
              class="input input-xs w-12 text-center"
              type="number"
              min="1"
              :value="focusedPoint?.timeSignatureNumerator ?? 4"
              @change="
                updateTimeSignatureNumerator(
                  Number(($event.target as HTMLInputElement).valueAsNumber),
                )
              "
            />
            <span>/</span>
            <select
              class="select select-xs w-12"
              :value="String(focusedPoint?.timeSignatureDenominator ?? 4)"
              @change="
                updateTimeSignatureDenominator(
                  Number(($event.target as HTMLSelectElement).value),
                )
              "
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="4">4</option>
              <option value="8">8</option>
              <option value="16">16</option>
            </select>
          </div>
        </div>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.is-selected {
  background-color: color-mix(
    in srgb,
    var(--color-primary, oklch(0.55 0.2 260)) 10%,
    transparent
  );
}

/* Active state: left border indicator only, no background */
.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: var(--color-success, oklch(0.6 0.2 140));
  border-radius: 0 2px 2px 0;
}

.is-selected-active {
  background-color: color-mix(
    in srgb,
    var(--color-primary, oklch(0.55 0.2 260)) 10%,
    transparent
  );
}
</style>
