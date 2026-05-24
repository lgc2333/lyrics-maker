<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

import { getActiveTimingPoint } from '../../core/timing/timing-engine'
import { formatTimestamp } from '../../core/utils/format-timestamp'
import { useEditorStore } from '../../stores/editor-store'

defineProps<{
  selectedId: string | null
}>()

defineEmits<{
  select: [id: string]
  remove: [id: string]
  cloneSelected: [id: string]
  addAtCurrentTime: []
}>()

const { t } = useI18n()

const store = useEditorStore()

function isActive(id: string): boolean {
  const points = store.project.timingPoints
  if (points.length === 0) return false
  try {
    return getActiveTimingPoint(points, store.currentTime).id === id
  } catch {
    return false
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <header class="flex items-center border-b border-base-300 px-3 py-1.5 text-xs">
      <span class="opacity-70">{{ t('timing.pointList.title') }}</span>
      <div class="ml-auto flex items-center gap-2">
        <button
          data-testid="clone-selected-point-at-current-time"
          class="btn btn-xs"
          :disabled="!selectedId"
          @click="$emit('cloneSelected', selectedId!)"
        >
          {{ t('timing.pointList.cloneSelected') }}
        </button>
        <button
          data-testid="add-point-at-current-time"
          class="btn btn-xs"
          @click="$emit('addAtCurrentTime')"
        >
          {{ t('timing.pointList.addAtCurrentTime') }}
        </button>
      </div>
    </header>

    <ul role="listbox" tabindex="0" class="min-h-0 flex-1 overflow-auto">
      <li
        v-for="point in store.project.timingPoints"
        :key="point.id"
        data-testid="timing-point-row"
        role="option"
        :aria-selected="selectedId === point.id"
        class="flex cursor-pointer items-center gap-3 border-b border-l-[3px] border-base-200 px-3 py-2 text-sm transition-colors hover:bg-base-200/80"
        :class="{
          'bg-primary/10': selectedId === point.id,
          'border-l-success rounded-r-sm': isActive(point.id),
          'border-l-transparent': !isActive(point.id),
        }"
        @click="$emit('select', point.id)"
      >
        <span class="w-24 tabular-nums">{{ formatTimestamp(point.time) }}</span>
        <span class="w-20 tabular-nums"
          >{{ point.bpm.toFixed(1) }} {{ t('timing.controls.bpm') }}</span
        >
        <span class="w-20 tabular-nums"
          >{{ point.timeSignatureNumerator }}/{{ point.timeSignatureDenominator }}</span
        >
        <button
          data-testid="remove-timing-point"
          class="btn btn-xs btn-ghost btn-square ml-auto"
          :title="t('timing.pointList.delete')"
          @click.stop="$emit('remove', point.id)"
        >
          <Icon
            icon="material-symbols:delete-outline"
            data-icon="remove-timing-point"
            class="h-4 w-4"
          />
        </button>
      </li>
    </ul>
  </div>
</template>
