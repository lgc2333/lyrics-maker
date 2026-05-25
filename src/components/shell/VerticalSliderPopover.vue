<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    dataTestid: string
    buttonTestid?: string
    panelTestid?: string
    min?: number
    max?: number
    sliderStep?: number
    wheelStep?: number
    popoverEnabled?: boolean
  }>(),
  {
    min: 0,
    max: 1,
    sliderStep: 0.01,
    wheelStep: 0.05,
    popoverEnabled: true,
  },
)

const emit = defineEmits<{
  click: []
  'update:modelValue': [value: number]
}>()

const open = ref(false)

const percentage = computed(() => Math.round(props.modelValue * 100))

function clamp(value: number): number {
  return Math.max(props.min, Math.min(props.max, value))
}

function onMouseenter(): void {
  open.value = props.popoverEnabled
}

function onWheel(event: WheelEvent): void {
  if (!props.popoverEnabled) return
  event.preventDefault()
  const delta = event.deltaY < 0 ? props.wheelStep : -props.wheelStep
  emit('update:modelValue', clamp(props.modelValue + delta))
}

function onSliderInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).valueAsNumber)
}
</script>

<template>
  <div
    :data-testid="dataTestid"
    class="relative"
    @mouseenter="onMouseenter"
    @mouseleave="open = false"
    @wheel="onWheel"
  >
    <button
      :data-testid="buttonTestid"
      class="btn btn-ghost btn-sm btn-square"
      :title="label"
      @click="emit('click')"
    >
      <slot name="icon" />
    </button>
    <div
      v-if="popoverEnabled"
      v-show="open"
      :data-testid="panelTestid"
      class="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded-md border border-base-300 bg-base-100 px-2 py-2 shadow-lg"
    >
      <div class="mb-1 text-center text-[10px] tabular-nums">{{ percentage }}%</div>
      <div class="relative h-24 w-6">
        <input
          class="range range-xs absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-90"
          type="range"
          :min="min"
          :max="max"
          :step="sliderStep"
          :value="modelValue"
          @input="onSliderInput"
        />
      </div>
    </div>
  </div>
</template>
