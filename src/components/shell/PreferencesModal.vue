<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  exportText: string
}>()

const emit = defineEmits<{
  close: []
  importSettings: [content: string]
  exportSettings: []
}>()

const { t } = useI18n()
const importText = ref('')
</script>

<template>
  <div
    data-testid="preferences-modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/35"
  >
    <section
      class="w-[min(36rem,calc(100vw-2rem))] rounded-md bg-base-100 p-4 shadow-xl"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold">{{ t('preferences.title') }}</h2>
        <button
          data-testid="preferences-close"
          class="btn btn-ghost btn-xs"
          @click="emit('close')"
        >
          {{ t('preferences.close') }}
        </button>
      </div>

      <textarea
        v-model="importText"
        data-testid="preferences-import-text"
        class="textarea textarea-bordered mb-3 h-32 w-full text-xs"
        :placeholder="t('preferences.importPlaceholder')"
      />

      <textarea
        data-testid="preferences-export-text"
        class="textarea textarea-bordered mb-3 h-32 w-full text-xs"
        readonly
        :value="props.exportText"
      />

      <div class="flex justify-end gap-2">
        <button
          data-testid="preferences-import"
          class="btn btn-sm"
          @click="emit('importSettings', importText)"
        >
          {{ t('preferences.import') }}
        </button>
        <button
          data-testid="preferences-export"
          class="btn btn-sm btn-primary"
          @click="emit('exportSettings')"
        >
          {{ t('preferences.export') }}
        </button>
      </div>
    </section>
  </div>
</template>
