<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  ACTION_LABEL_KEYS,
  COMMAND_LABEL_KEYS,
  REASON_LABEL_KEYS,
  RHYTHM_MODE_LABEL_KEYS,
} from '../../i18n/status-label-maps'
import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()
const { t, te } = useI18n()

function translateMappedValue(
  value: string | number | boolean,
  map: Record<string, string>,
): string | number | boolean {
  if (typeof value !== 'string') return value
  const key = map[value]
  if (!key) return value
  return te(key) ? t(key) : value
}

const messageText = computed(() => {
  const message = store.statusMessage
  if (!message) return t('status.ready')

  const params = { ...(message.params ?? {}) }
  if (params.commandLabel !== undefined) {
    params.commandLabel = translateMappedValue(params.commandLabel, COMMAND_LABEL_KEYS)
  }
  if (params.action !== undefined) {
    params.action = translateMappedValue(params.action, ACTION_LABEL_KEYS)
  }
  if (params.mode !== undefined) {
    params.mode = translateMappedValue(params.mode, RHYTHM_MODE_LABEL_KEYS)
  }
  if (params.reason !== undefined) {
    params.reason = translateMappedValue(params.reason, REASON_LABEL_KEYS)
  }

  return te(message.key) ? t(message.key, params) : message.key
})
</script>

<template>
  <footer
    data-testid="status-bar"
    class="flex h-7 shrink-0 items-center gap-3 border-t border-base-300 bg-base-100 px-2 text-xs"
  >
    <div data-testid="status-message" class="min-w-0 flex-1 truncate">
      {{ messageText }}
    </div>
    <div
      data-testid="status-persistent"
      class="shrink-0 tabular-nums"
      :class="store.dirty ? 'text-warning' : 'text-base-content/60'"
    >
      {{ store.dirty ? t('status.dirty') : t('status.saved') }}
    </div>
  </footer>
</template>
