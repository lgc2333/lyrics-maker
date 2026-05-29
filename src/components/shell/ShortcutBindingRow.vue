<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { ACTION_LABEL_KEYS } from '../../i18n/status-label-maps'
import type { ShortcutAction } from '../../platform/shortcuts/registry'

const props = defineProps<{
  action: ShortcutAction
  effectiveKeystroke: string | null
  isOverridden: boolean
  capturing: boolean
}>()

const emit = defineEmits<{
  startCapture: [action: ShortcutAction]
  cancelCapture: []
  reset: [action: ShortcutAction]
  clear: [action: ShortcutAction]
}>()

const { t, te } = useI18n()

const actionLabel = computed(() => {
  const key = ACTION_LABEL_KEYS[props.action]
  return key && te(key) ? t(key) : props.action
})

const keystrokeDisplay = computed(() => {
  if (props.capturing) return t('preferences.shortcuts.capturing')
  return props.effectiveKeystroke ?? t('preferences.shortcuts.unbound')
})
</script>

<template>
  <li
    class="flex items-center justify-between gap-3 rounded px-2 py-1.5"
    :class="{ 'ring-2 ring-primary bg-base-200/60': capturing }"
  >
    <span data-testid="shortcut-row-action" class="flex-1 truncate text-sm">{{
      actionLabel
    }}</span>
    <span
      data-testid="shortcut-row-keystroke"
      class="min-w-[8rem] text-right text-sm tabular-nums"
      :class="{
        'italic text-base-content/60': !capturing && effectiveKeystroke === null,
        'text-primary': capturing,
      }"
      >{{ keystrokeDisplay }}</span
    >
    <template v-if="capturing">
      <button
        data-testid="shortcut-row-cancel"
        type="button"
        class="btn btn-ghost btn-xs"
        @click="emit('cancelCapture')"
      >
        {{ t('preferences.shortcuts.cancelCapture') }}
      </button>
      <button
        data-testid="shortcut-row-clear"
        type="button"
        class="btn btn-ghost btn-xs"
        @click="emit('clear', props.action)"
      >
        {{ t('preferences.shortcuts.clear') }}
      </button>
    </template>
    <template v-else>
      <button
        data-testid="shortcut-row-assign"
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :aria-label="t('preferences.shortcuts.assign')"
        :title="t('preferences.shortcuts.assign')"
        @click="emit('startCapture', props.action)"
      >
        <Icon icon="material-symbols:keyboard-outline" class="h-4 w-4" />
      </button>
      <button
        data-testid="shortcut-row-reset"
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :disabled="!isOverridden"
        :aria-label="t('preferences.shortcuts.reset')"
        :title="t('preferences.shortcuts.reset')"
        @click="emit('reset', props.action)"
      >
        <Icon icon="material-symbols:restart-alt" class="h-4 w-4" />
      </button>
    </template>
  </li>
</template>
