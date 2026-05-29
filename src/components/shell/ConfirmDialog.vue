<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'neutral' | 'danger'
  }>(),
  {
    confirmLabel: undefined,
    cancelLabel: undefined,
    tone: 'neutral',
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const { t } = useI18n()

const resolvedConfirmLabel = computed(() => props.confirmLabel ?? t('common.confirm'))
const resolvedCancelLabel = computed(() => props.cancelLabel ?? t('common.cancel'))
const confirmButtonClass = computed(() =>
  props.tone === 'danger' ? 'btn-error' : 'btn-primary',
)
</script>

<template>
  <div
    data-testid="confirm-dialog"
    class="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 px-4"
    role="dialog"
    aria-modal="true"
    :aria-label="props.title"
    tabindex="-1"
    @keydown.escape.stop.prevent="emit('cancel')"
  >
    <section
      class="w-full max-w-md rounded-md border border-base-300 bg-base-100 p-4 shadow-xl"
    >
      <h2 data-testid="confirm-dialog-title" class="text-base font-semibold">
        {{ props.title }}
      </h2>
      <p data-testid="confirm-dialog-message" class="mt-2 text-sm text-base-content/75">
        {{ props.message }}
      </p>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button
          data-testid="confirm-dialog-cancel"
          type="button"
          class="btn btn-sm btn-ghost"
          @click="emit('cancel')"
        >
          {{ resolvedCancelLabel }}
        </button>
        <button
          data-testid="confirm-dialog-confirm"
          type="button"
          class="btn btn-sm"
          :class="confirmButtonClass"
          @click="emit('confirm')"
        >
          {{ resolvedConfirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>
