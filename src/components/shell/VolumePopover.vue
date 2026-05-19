<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    volume: number
    icon: string
    label: string
    dataTestid: string
    min?: number
    max?: number
    sliderStep?: number
    wheelStep?: number
  }>(),
  {
    min: 0,
    max: 1,
    sliderStep: 0.01,
    wheelStep: 0.05,
  },
)

const emit = defineEmits<{
  'update:volume': [volume: number]
}>()

const open = ref(false)

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const delta = event.deltaY < 0 ? props.wheelStep : -props.wheelStep
  emit('update:volume', Math.max(props.min, Math.min(props.max, props.volume + delta)))
}

function onSliderInput(event: Event): void {
  emit('update:volume', (event.target as HTMLInputElement).valueAsNumber)
}
</script>

<template>
  <div
    :data-testid="dataTestid"
    class="relative"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @wheel="onWheel"
  >
    <button class="btn btn-ghost btn-sm btn-square" :title="label">
      <Icon :icon="icon" class="h-5 w-5" />
    </button>
    <div
      v-show="open"
      class="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded-md border border-base-300 bg-base-100 px-2 py-2 shadow-lg"
    >
      <div class="mb-1 text-center text-[10px] tabular-nums">
        {{ Math.round(volume * 100) }}%
      </div>
      <div class="relative h-24 w-6">
        <input
          class="range range-xs absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-90"
          type="range"
          :min="min"
          :max="max"
          :step="sliderStep"
          :value="volume"
          @input="onSliderInput"
        />
      </div>
    </div>
  </div>
</template>
