<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LyricsDisplayFormatId, LyricsFormatId } from '../../core/lyrics-io/types'

const props = defineProps<{
  fileName: string
  format: LyricsFormatId
  displayFormat?: LyricsDisplayFormatId
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const { t, te } = useI18n()

const formatLabel = computed(() => {
  const displayFormat = props.displayFormat ?? props.format
  const key = `lyrics.import.formats.${displayFormat}`
  return te(key) ? t(key) : displayFormat.toUpperCase()
})
</script>

<template>
  <div
    data-testid="import-confirm-modal"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('lyrics.import.confirmTitle')"
  >
    <section
      class="w-full max-w-md rounded-md border border-base-300 bg-base-100 p-4 shadow-xl"
    >
      <h2 class="text-base font-semibold">
        {{ t('lyrics.import.confirmTitle') }}
      </h2>
      <p class="mt-2 text-sm text-base-content/75">
        {{ t('lyrics.import.confirmMessage', { fileName, format: formatLabel }) }}
      </p>
      <p class="mt-2 text-sm text-warning">
        {{ t('lyrics.import.replaceWarning') }}
      </p>
      <p class="mt-1 text-sm text-base-content/70">
        {{ t('lyrics.import.preserveNote') }}
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <button
          data-testid="import-cancel"
          type="button"
          class="btn btn-sm btn-ghost"
          @click="emit('cancel')"
        >
          {{ t('lyrics.import.cancel') }}
        </button>
        <button
          data-testid="import-confirm"
          type="button"
          class="btn btn-sm btn-primary"
          @click="emit('confirm')"
        >
          {{ t('lyrics.import.confirm') }}
        </button>
      </div>
    </section>
  </div>
</template>
