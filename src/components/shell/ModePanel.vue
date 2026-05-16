<script setup lang="ts">
import { getActiveTimingPoint } from '../../core/timing/timing-engine'
import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()

function activeBpm(): number {
  const points = store.project.timingPoints
  if (points.length === 0) return 120
  return getActiveTimingPoint(points, store.currentTime).bpm
}

function onTapBpm() {
  store.tapBpm()
}
</script>

<template>
  <section class="flex-1 border-t border-base-300 p-4">
    <div class="flex flex-col gap-3">
      <!-- TAP BPM -->
      <div class="flex items-center gap-2">
        <button class="btn btn-sm btn-primary" @click="onTapBpm">TAP BPM (B)</button>
        <span class="text-sm">BPM: {{ activeBpm() }}</span>
        <span v-if="store.tapSampleCount > 0" class="text-xs opacity-70">
          ({{ store.tapSampleCount }} 次敲击)
        </span>
      </div>

      <!-- Metronome toggle -->
      <div class="flex items-center gap-2">
        <button class="btn btn-sm" @click="store.toggleMetronome()">
          节拍器:
          {{
            store.metronomeState === 'on'
              ? '开'
              : store.metronomeState === 'latch_pending'
                ? '收尾中'
                : '关'
          }}
          (M)
        </button>
      </div>

      <!-- Timing Points list -->
      <div class="text-sm">
        <h3 class="font-semibold mb-1">Timing Points</h3>
        <ul>
          <li
            v-for="point in store.project.timingPoints"
            :key="point.id"
            class="flex items-center gap-2 py-1"
          >
            <span class="text-xs opacity-70">{{ point.time.toFixed(1) }}s</span>
            <span>{{ point.bpm }} BPM</span>
            <span class="text-xs"
              >{{ point.timeSignatureNumerator }}/{{
                point.timeSignatureDenominator
              }}</span
            >
            <button
              class="btn btn-xs btn-ghost"
              @click="store.removeTimingPoint(point.id)"
            >
              删除
            </button>
          </li>
        </ul>
        <button
          class="btn btn-xs mt-1"
          @click="
            store.addTimingPoint({
              time: store.currentTime,
              bpm: activeBpm(),
              timeSignatureNumerator: 4,
              timeSignatureDenominator: 4,
              offsetMs: 0,
            })
          "
        >
          在此添加 Timing Point
        </button>
      </div>
    </div>
  </section>
</template>
