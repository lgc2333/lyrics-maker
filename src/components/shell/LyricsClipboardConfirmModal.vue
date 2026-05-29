<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  lines: readonly string[]
  insertionPosition: 'selected-line-below' | 'list-bottom'
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const { t } = useI18n()

const insertionPositionText = computed(() =>
  props.insertionPosition === 'selected-line-below'
    ? t('lyrics.clipboard.positionSelectedLineBelow')
    : t('lyrics.clipboard.positionListBottom'),
)
</script>

<template>
  <div
    data-testid="lyrics-clipboard-confirm-modal"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('lyrics.clipboard.confirmTitle')"
  >
    <section
      class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-md border border-base-300 bg-base-100 p-4 shadow-xl"
    >
      <h2 class="text-base font-semibold">
        {{ t('lyrics.clipboard.confirmTitle') }}
      </h2>
      <p class="mt-2 text-sm text-base-content/75">
        {{ t('lyrics.clipboard.confirmMessage') }}
      </p>
      <p class="mt-2 text-sm text-base-content/70">
        {{ t('lyrics.clipboard.insertPosition', { position: insertionPositionText }) }}
      </p>
      <ol
        data-testid="clipboard-preview-list"
        class="mt-3 min-h-0 overflow-auto rounded border border-base-300 bg-base-200/40 py-1 text-sm"
      >
        <li
          v-for="(line, index) in lines"
          :key="`${index}-${line}`"
          class="flex gap-3 px-3 py-1"
        >
          <span class="w-8 shrink-0 text-right tabular-nums text-base-content/45">
            {{ index + 1 }}
          </span>
          <span class="min-w-0 flex-1 break-words">{{ line }}</span>
        </li>
      </ol>
      <div class="mt-4 flex justify-end gap-2">
        <button
          data-testid="clipboard-cancel"
          type="button"
          class="btn btn-sm btn-ghost"
          @click="emit('cancel')"
        >
          {{ t('lyrics.clipboard.cancel') }}
        </button>
        <button
          data-testid="clipboard-confirm"
          type="button"
          class="btn btn-sm btn-primary"
          @click="emit('confirm')"
        >
          {{ t('lyrics.clipboard.confirm') }}
        </button>
      </div>
    </section>
  </div>
</template>
