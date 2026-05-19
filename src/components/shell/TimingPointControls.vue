<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TimingPoint } from '../../core/domain/project'
import { useEditorStore } from '../../stores/editor-store'

defineProps<{
  focusedPoint: TimingPoint | null
  activePoint: TimingPoint | null
}>()

const emit = defineEmits<{
  adjustTime: [deltaMs: number]
  setOffsetToCurrentTime: []
  setOffset: [seconds: number]
  adjustBpm: [delta: number]
  setBpm: [bpm: number]
  updateNumerator: [value: number]
  updateDenominator: [value: number]
  tapBpm: []
}>()

const { t } = useI18n()

const store = useEditorStore()

/** Label for the Tap BPM button based on tap state */
const TAP_MIN_SAMPLES = 9

const tapBpmLabel = computed(() => {
  const count = store.tapCount
  const bpm = store.tapEstimatedBpm
  if (count === 0) return t('timing.controls.tapBpmIdle')
  if (bpm === null) {
    const remaining = TAP_MIN_SAMPLES - count
    return `${t('timing.controls.tapBpmHint')}${'.'.repeat(Math.max(1, remaining))}`
  }
  return t('timing.controls.tapBpmActive', { bpm: bpm.toFixed(1), count })
})

const tapBpmClass = computed(() => {
  const count = store.tapCount
  if (count === 0) return 'btn btn-sm w-full mb-2'
  if (store.tapEstimatedBpm === null) return 'btn btn-sm w-full mb-2 btn-warning'
  return 'btn btn-sm w-full mb-2 btn-success'
})
</script>

<template>
  <aside
    class="w-[320px] shrink-0 border-l border-base-300 bg-base-100 text-sm"
    data-testid="timing-right-panel"
  >
    <div class="border-b border-base-300 px-3 py-2">
      <div class="flex items-center justify-between">
        <span>{{ t('timing.controls.offset') }}</span>
        <div class="flex items-center gap-1">
          <input
            class="input input-xs w-24 text-right tabular-nums"
            type="number"
            step="0.001"
            min="0"
            :max="store.duration || 0"
            :value="(focusedPoint?.time ?? store.currentTime).toFixed(3)"
            @change="
              emit('setOffset', Number(($event.target as HTMLInputElement).value))
            "
          />
          <span class="text-xs opacity-50">s</span>
        </div>
      </div>
      <button
        data-testid="set-offset-to-current-time"
        class="btn btn-sm w-full mt-2"
        @click="$emit('setOffsetToCurrentTime')"
      >
        {{ t('timing.controls.setToCurrentTime') }}
      </button>
      <div class="mt-2 flex items-center justify-center gap-1">
        <button
          data-testid="offset-minus-10"
          class="btn btn-xs"
          @click="$emit('adjustTime', -10)"
        >
          10
        </button>
        <button
          data-testid="offset-minus-5"
          class="btn btn-xs"
          @click="$emit('adjustTime', -5)"
        >
          5
        </button>
        <button
          data-testid="offset-minus-2"
          class="btn btn-xs"
          @click="$emit('adjustTime', -2)"
        >
          2
        </button>
        <button
          data-testid="offset-minus-1"
          class="btn btn-xs"
          @click="$emit('adjustTime', -1)"
        >
          1
        </button>
        <span class="text-xs opacity-50">-</span>
        <span class="text-xs opacity-50">(ms)</span>
        <span class="text-xs opacity-50">+</span>
        <button
          data-testid="offset-plus-1"
          class="btn btn-xs"
          @click="$emit('adjustTime', 1)"
        >
          1
        </button>
        <button
          data-testid="offset-plus-2"
          class="btn btn-xs"
          @click="$emit('adjustTime', 2)"
        >
          2
        </button>
        <button
          data-testid="offset-plus-5"
          class="btn btn-xs"
          @click="$emit('adjustTime', 5)"
        >
          5
        </button>
        <button
          data-testid="offset-plus-10"
          class="btn btn-xs"
          @click="$emit('adjustTime', 10)"
        >
          10
        </button>
      </div>
    </div>

    <div class="border-b border-base-300 px-3 py-2">
      <div class="mb-2 flex items-center justify-between">
        <span>{{ t('timing.controls.bpm') }}</span>
        <input
          class="input input-xs w-26 text-right tabular-nums"
          type="number"
          step="0.1"
          min="1"
          :value="(focusedPoint?.bpm ?? activePoint?.bpm ?? 120).toFixed(1)"
          @change="emit('setBpm', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <button
        data-testid="tap-bpm-button"
        :class="tapBpmClass"
        :disabled="store.duration <= 0"
        @click="$emit('tapBpm')"
      >
        {{ tapBpmLabel }}
      </button>
      <div class="flex items-center justify-center gap-1">
        <button class="btn btn-xs" @click="$emit('adjustBpm', -1)">1</button>
        <button class="btn btn-xs" @click="$emit('adjustBpm', -0.5)">.5</button>
        <button class="btn btn-xs" @click="$emit('adjustBpm', -0.2)">.2</button>
        <button class="btn btn-xs" @click="$emit('adjustBpm', -0.1)">.1</button>
        <span class="text-xs opacity-50">-</span>
        <span class="text-xs opacity-50">|</span>
        <span class="text-xs opacity-50">+</span>
        <button class="btn btn-xs" @click="$emit('adjustBpm', 0.1)">.1</button>
        <button class="btn btn-xs" @click="$emit('adjustBpm', 0.2)">.2</button>
        <button class="btn btn-xs" @click="$emit('adjustBpm', 0.5)">.5</button>
        <button class="btn btn-xs" @click="$emit('adjustBpm', 1)">1</button>
      </div>
    </div>

    <div class="px-3 py-2">
      <div class="mb-1 flex items-center justify-between">
        <span>{{ t('timing.controls.timeSignature') }}</span>
        <div class="flex items-center gap-2">
          <input
            class="input input-xs w-14 text-center"
            type="number"
            min="1"
            :value="focusedPoint?.timeSignatureNumerator ?? 4"
            @change="
              emit(
                'updateNumerator',
                Number(($event.target as HTMLInputElement).valueAsNumber),
              )
            "
          />
          <span>/</span>
          <select
            class="select select-xs w-14"
            :value="String(focusedPoint?.timeSignatureDenominator ?? 4)"
            @change="
              emit(
                'updateDenominator',
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
</template>
