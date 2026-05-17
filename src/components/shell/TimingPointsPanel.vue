<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'

import { getActiveTimingPoint } from '../../core/timing/timing-engine'
import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()
const selectedId = ref<string | null>(null)
const activeId = computed(() => store.activeTimingPointId)

function isSelected(id: string) {
  return selectedId.value === id
}

function isActive(id: string) {
  return activeId.value === id
}

function activeBpm(): number {
  const points = store.project.timingPoints
  if (points.length === 0) return 120
  return getActiveTimingPoint(points, store.currentTime).bpm
}

const selectedPoint = computed(
  () => store.project.timingPoints.find((p) => p.id === selectedId.value) ?? null,
)

function adjustOffset(deltaMs: number) {
  if (!selectedPoint.value) return
  store.updateTimingPoint(selectedPoint.value.id, {
    offsetMs: selectedPoint.value.offsetMs + deltaMs,
  })
}

function addPointAtCurrentTime() {
  store.addTimingPoint({
    time: store.currentTime,
    bpm: selectedPoint.value?.bpm ?? 120,
    timeSignatureNumerator: selectedPoint.value?.timeSignatureNumerator ?? 4,
    timeSignatureDenominator: selectedPoint.value?.timeSignatureDenominator ?? 4,
    offsetMs: selectedPoint.value?.offsetMs ?? 0,
  })
}

async function onTapBpm() {
  await store.tapBpm()
}
</script>

<template>
  <section
    data-testid="timing-points-panel"
    class="flex flex-1 overflow-hidden border-t border-base-300"
  >
    <!-- Left: Timing Points List -->
    <ul class="flex-1 overflow-auto">
      <li
        v-for="point in store.project.timingPoints"
        :key="point.id"
        data-testid="timing-point-row"
        class="flex items-center gap-2 cursor-pointer px-3 py-1.5 text-xs hover:bg-base-200 border-b border-base-200"
        :class="{
          'is-selected': isSelected(point.id),
          'is-active': isActive(point.id),
          'is-selected-active': isSelected(point.id) && isActive(point.id),
        }"
        @click="selectedId = point.id"
      >
        <span class="tabular-nums w-14">{{ point.time.toFixed(1) }}s</span>
        <span class="w-16">{{ point.bpm }} BPM</span>
        <span class="w-10"
          >{{ point.timeSignatureNumerator }}/{{ point.timeSignatureDenominator }}</span
        >
        <span class="opacity-60">{{ point.offsetMs }}ms</span>
        <button
          class="btn btn-xs btn-ghost ml-auto"
          @click.stop="store.removeTimingPoint(point.id)"
        >
          删除
        </button>
      </li>
      <li
        v-if="store.project.timingPoints.length === 0"
        class="px-3 py-4 text-xs opacity-50 text-center"
      >
        暂无 Timing Point，请在下方添加
      </li>
    </ul>

    <!-- Right: Controls -->
    <aside class="w-64 flex flex-col gap-3 border-l border-base-300 p-3 text-xs">
      <!-- Offset -->
      <div>
        <div class="mb-1 opacity-70">Offset</div>
        <div class="mb-1 tabular-nums">{{ selectedPoint?.offsetMs ?? 0 }} ms</div>
        <div class="flex gap-1 flex-wrap">
          <button
            data-testid="offset-minus-10"
            class="btn btn-xs"
            @click="adjustOffset(-10)"
          >
            -10
          </button>
          <button
            data-testid="offset-minus-5"
            class="btn btn-xs"
            @click="adjustOffset(-5)"
          >
            -5
          </button>
          <button
            data-testid="offset-minus-1"
            class="btn btn-xs"
            @click="adjustOffset(-1)"
          >
            -1
          </button>
          <button
            data-testid="offset-plus-1"
            class="btn btn-xs"
            @click="adjustOffset(1)"
          >
            +1
          </button>
          <button
            data-testid="offset-plus-5"
            class="btn btn-xs"
            @click="adjustOffset(5)"
          >
            +5
          </button>
          <button
            data-testid="offset-plus-10"
            class="btn btn-xs"
            @click="adjustOffset(10)"
          >
            +10
          </button>
        </div>
      </div>

      <!-- BPM -->
      <div>
        <div class="mb-1 opacity-70">BPM</div>
        <div class="mb-1 tabular-nums">{{ selectedPoint?.bpm ?? activeBpm() }}</div>
        <div class="flex gap-1 flex-wrap">
          <button
            data-testid="bpm-minus-1"
            class="btn btn-xs"
            @click="
              selectedPoint &&
              store.updateTimingPoint(selectedPoint.id, { bpm: selectedPoint.bpm - 1 })
            "
          >
            -1
          </button>
          <button
            data-testid="bpm-minus-0.5"
            class="btn btn-xs"
            @click="
              selectedPoint &&
              store.updateTimingPoint(selectedPoint.id, {
                bpm: selectedPoint.bpm - 0.5,
              })
            "
          >
            -0.5
          </button>
          <button
            data-testid="bpm-minus-0.1"
            class="btn btn-xs"
            @click="
              selectedPoint &&
              store.updateTimingPoint(selectedPoint.id, {
                bpm: selectedPoint.bpm - 0.1,
              })
            "
          >
            -0.1
          </button>
          <button
            data-testid="bpm-plus-0.1"
            class="btn btn-xs"
            @click="
              selectedPoint &&
              store.updateTimingPoint(selectedPoint.id, {
                bpm: selectedPoint.bpm + 0.1,
              })
            "
          >
            +0.1
          </button>
          <button
            data-testid="bpm-plus-0.5"
            class="btn btn-xs"
            @click="
              selectedPoint &&
              store.updateTimingPoint(selectedPoint.id, {
                bpm: selectedPoint.bpm + 0.5,
              })
            "
          >
            +0.5
          </button>
          <button
            data-testid="bpm-plus-1"
            class="btn btn-xs"
            @click="
              selectedPoint &&
              store.updateTimingPoint(selectedPoint.id, { bpm: selectedPoint.bpm + 1 })
            "
          >
            +1
          </button>
        </div>
      </div>

      <!-- TAP BPM -->
      <button
        data-testid="tap-bpm-button"
        class="btn btn-sm btn-primary"
        @click="onTapBpm"
      >
        <Icon icon="material-symbols:touch-app-rounded" class="mr-1" />
        TAP BPM
      </button>
      <span v-if="store.tapSampleCount > 0" class="opacity-70">
        {{ store.tapSampleCount }} 次敲击
        <template v-if="store.tapEstimatedBpm">
          · {{ store.tapEstimatedBpm.toFixed(1) }} BPM</template
        >
      </span>

      <!-- Metronome -->
      <button class="btn btn-sm" @click="store.toggleMetronome()">
        <Icon icon="material-symbols:metronome" class="mr-1" />
        节拍器:
        {{
          store.metronomeState === 'on'
            ? '开'
            : store.metronomeState === 'latch_pending'
              ? '收尾中'
              : '关'
        }}
      </button>

      <!-- Add point -->
      <button
        data-testid="add-point-at-current-time"
        class="btn btn-sm mt-2"
        @click="addPointAtCurrentTime"
      >
        在此添加 Timing Point
      </button>
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
.is-active {
  background-color: color-mix(
    in srgb,
    var(--color-success, oklch(0.55 0.2 140)) 10%,
    transparent
  );
}
.is-selected-active {
  background-color: color-mix(
    in srgb,
    var(--color-primary, oklch(0.55 0.2 260)) 20%,
    transparent
  );
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--color-primary, oklch(0.55 0.2 260)) 30%, transparent);
}
</style>
