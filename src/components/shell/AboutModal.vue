<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  version: string
  commit: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const GITHUB_URL = 'https://github.com/lgc2333/lyrics-maker'
</script>

<template>
  <div
    data-testid="about-modal"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('shell.about.title')"
    @click.self="emit('close')"
    @keydown.escape.stop.prevent="emit('close')"
  >
    <section
      data-testid="about-dialog"
      class="w-full max-w-md rounded-md border border-base-300 bg-base-100 p-5 shadow-xl"
      @click.stop
    >
      <header class="flex items-center justify-between">
        <h2 class="text-base font-semibold">{{ t('shell.about.title') }}</h2>
        <button
          data-testid="about-close"
          type="button"
          class="btn btn-ghost btn-sm btn-square"
          :aria-label="t('shell.about.close')"
          @click="emit('close')"
        >
          <Icon icon="material-symbols:close-rounded" class="h-5 w-5" />
        </button>
      </header>

      <div class="mt-4 flex flex-col items-center gap-2 text-center">
        <div class="text-lg font-semibold">{{ t('shell.appTitle') }}</div>
        <div class="text-sm text-base-content/75">
          {{ t('shell.about.madeWith') }}
        </div>
        <div data-testid="about-version" class="font-mono text-sm">
          v{{ version }} ({{ commit }})
        </div>
        <a
          data-testid="about-github-link"
          :href="GITHUB_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="link link-primary break-all text-sm"
        >
          {{ GITHUB_URL }}
        </a>
      </div>
    </section>
  </div>
</template>
