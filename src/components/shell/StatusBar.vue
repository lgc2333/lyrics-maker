<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()
const { t, te } = useI18n()

const COMMAND_LABEL_KEYS: Record<string, string> = {
  'audio.setMusicVolume': 'status.command.audio.setMusicVolume',
  'audio.setSfxVolume': 'status.command.audio.setSfxVolume',
  'lyrics.addLine': 'status.command.lyrics.addLine',
  'lyrics.clearWordEndTime': 'status.command.lyrics.clearWordEndTime',
  'lyrics.insertLines': 'status.command.lyrics.insertLines',
  'lyrics.insertWord': 'status.command.lyrics.insertWord',
  'lyrics.mergeWords': 'status.command.lyrics.mergeWords',
  'lyrics.removeLine': 'status.command.lyrics.removeLine',
  'lyrics.removeWord': 'status.command.lyrics.removeWord',
  'lyrics.replaceLineWords': 'status.command.lyrics.replaceLineWords',
  'lyrics.setLineStartTime': 'status.command.lyrics.setLineStartTime',
  'lyrics.setWordEndTime': 'status.command.lyrics.setWordEndTime',
  'lyrics.splitWord': 'status.command.lyrics.splitWord',
  'lyrics.updateWordText': 'status.command.lyrics.updateWordText',
  'settings.setRhythmMode': 'status.command.settings.setRhythmMode',
  'settings.setSnapDivisor': 'status.command.settings.setSnapDivisor',
  'settings.setSnapEnabled': 'status.command.settings.setSnapEnabled',
  'timing.addPoint': 'status.command.timing.addPoint',
  'timing.removePoint': 'status.command.timing.removePoint',
  'timing.updatePoint': 'status.command.timing.updatePoint',
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  'transport.nextBar': 'status.action.transport.nextBar',
  'transport.nextBeat': 'status.action.transport.nextBeat',
  'transport.playPause': 'status.action.transport.playPause',
  'transport.prevBar': 'status.action.transport.prevBar',
  'transport.prevBeat': 'status.action.transport.prevBeat',
  'transport.seek': 'status.action.transport.seek',
  'lyrics.mark': 'status.action.lyrics.mark',
  'lyrics.nextLine': 'status.action.lyrics.nextLine',
  'lyrics.playLineInterval': 'status.action.lyrics.playLineInterval',
  'lyrics.playWordInterval': 'status.action.lyrics.playWordInterval',
}

const RHYTHM_MODE_LABEL_KEYS: Record<string, string> = {
  common: 'transport.rhythmCommon',
  triplets: 'transport.rhythmTriplets',
}

const REASON_LABEL_KEYS: Record<string, string> = {
  cancelled: 'status.reason.cancelled',
  failed: 'status.reason.failed',
  invalid: 'status.reason.invalid',
  no_cached_handle: 'status.reason.noCachedHandle',
  no_draft: 'status.reason.noDraft',
  unknown: 'status.reason.unknown',
  unsupported: 'status.reason.unsupported',
}

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
    class="flex h-6 shrink-0 items-center gap-3 border-t border-base-300 bg-base-100 px-2 text-[11px]"
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
