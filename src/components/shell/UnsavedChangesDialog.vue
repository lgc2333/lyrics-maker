<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  saveAndOpen: []
  discardAndOpen: []
  cancel: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    data-testid="unsaved-changes-dialog"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('project.unsavedDialog.title')"
  >
    <section
      class="w-full max-w-md rounded-md border border-base-300 bg-base-100 p-4 shadow-xl"
    >
      <h2 class="text-base font-semibold">
        {{ t('project.unsavedDialog.title') }}
      </h2>
      <p class="mt-2 text-sm text-base-content/75">
        {{ t('project.unsavedDialog.message') }}
      </p>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button
          data-testid="unsaved-cancel"
          type="button"
          class="btn btn-sm btn-ghost"
          @click="emit('cancel')"
        >
          {{ t('project.unsavedDialog.cancel') }}
        </button>
        <button
          data-testid="unsaved-discard-open"
          type="button"
          class="btn btn-sm"
          @click="emit('discardAndOpen')"
        >
          {{ t('project.unsavedDialog.discardAndOpen') }}
        </button>
        <button
          data-testid="unsaved-save-open"
          type="button"
          class="btn btn-sm btn-primary"
          @click="emit('saveAndOpen')"
        >
          {{ t('project.unsavedDialog.saveAndOpen') }}
        </button>
      </div>
    </section>
  </div>
</template>
