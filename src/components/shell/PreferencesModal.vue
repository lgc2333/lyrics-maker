<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LocalLocale, LocalTheme } from '../../platform/settings/local-settings'

type Category = 'general' | 'shortcuts' | 'backup'

const props = defineProps<{
  localeMode: LocalLocale
  themeMode: LocalTheme
  effectiveTheme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  close: []
  updateLocaleMode: [locale: LocalLocale]
  updateThemeMode: [theme: LocalTheme]
  backupSettings: []
  restoreSettings: []
}>()

const { t } = useI18n()
const activeCategory = shallowRef<Category>('general')

const categories: Array<{ key: Category; labelKey: string; testid: string }> = [
  {
    key: 'general',
    labelKey: 'preferences.categories.general',
    testid: 'preferences-tab-general',
  },
  {
    key: 'shortcuts',
    labelKey: 'preferences.categories.shortcuts',
    testid: 'preferences-tab-shortcuts',
  },
  {
    key: 'backup',
    labelKey: 'preferences.categories.backup',
    testid: 'preferences-tab-backup',
  },
]

const themeOptions: Array<{ value: LocalTheme; labelKey: string; testid: string }> = [
  {
    value: 'light',
    labelKey: 'preferences.theme.light',
    testid: 'preferences-theme-light',
  },
  {
    value: 'dark',
    labelKey: 'preferences.theme.dark',
    testid: 'preferences-theme-dark',
  },
  {
    value: 'system',
    labelKey: 'preferences.theme.system',
    testid: 'preferences-theme-system',
  },
]

const localeOptions: Array<{ value: LocalLocale; labelKey: string }> = [
  { value: 'system', labelKey: 'preferences.locale.system' },
  { value: 'zh-CN', labelKey: 'preferences.locale.zhCN' },
]

const effectiveThemeLabel = computed(() =>
  props.effectiveTheme === 'dark'
    ? t('preferences.theme.dark')
    : t('preferences.theme.light'),
)
</script>

<template>
  <div
    data-testid="preferences-modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
    @keydown.escape.stop.prevent="emit('close')"
  >
    <section
      role="dialog"
      aria-modal="true"
      class="flex h-[min(38rem,calc(100vh-2rem))] w-[min(52rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-2xl"
    >
      <header
        class="flex shrink-0 items-center justify-between border-b border-base-300 px-4 py-3"
      >
        <h2 class="text-base font-semibold">{{ t('preferences.title') }}</h2>
        <button
          data-testid="preferences-close"
          class="btn btn-ghost btn-sm btn-square"
          :aria-label="t('preferences.close')"
          @click="emit('close')"
        >
          <Icon icon="material-symbols:close-rounded" class="h-5 w-5" />
        </button>
      </header>

      <div class="grid min-h-0 flex-1 grid-cols-[11rem_1fr]">
        <aside class="border-r border-base-300 bg-base-200/40 p-2">
          <button
            v-for="category in categories"
            :key="category.key"
            :data-testid="category.testid"
            class="mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
            :class="
              activeCategory === category.key
                ? 'bg-base-100 font-semibold shadow-sm'
                : 'text-base-content/70 hover:bg-base-100/70 hover:text-base-content'
            "
            @click="activeCategory = category.key"
          >
            {{ t(category.labelKey) }}
          </button>
        </aside>

        <main class="min-h-0 overflow-auto p-5">
          <section
            v-if="activeCategory === 'general'"
            data-testid="preferences-panel-general"
            class="max-w-xl"
          >
            <label class="mb-6 block max-w-xs">
              <span class="mb-1 block text-sm font-semibold">
                {{ t('preferences.locale.title') }}
              </span>
              <span class="mb-3 block text-sm text-base-content/70">
                {{ t('preferences.locale.description') }}
              </span>
              <select
                data-testid="preferences-locale-select"
                class="select select-sm w-full"
                :value="props.localeMode"
                @change="
                  emit(
                    'updateLocaleMode',
                    ($event.target as HTMLSelectElement).value as LocalLocale,
                  )
                "
              >
                <option
                  v-for="option in localeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ t(option.labelKey) }}
                </option>
              </select>
            </label>

            <h3 class="mb-1 text-sm font-semibold">
              {{ t('preferences.theme.title') }}
            </h3>
            <p class="mb-3 text-sm text-base-content/70">
              {{ t('preferences.theme.description') }}
            </p>
            <div class="join">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                :data-testid="option.testid"
                class="btn btn-sm join-item"
                :class="{ 'btn-active btn-primary': props.themeMode === option.value }"
                @click="emit('updateThemeMode', option.value)"
              >
                {{ t(option.labelKey) }}
              </button>
            </div>
            <p
              v-if="props.themeMode === 'system'"
              class="mt-3 text-xs text-base-content/60"
            >
              {{
                t('preferences.theme.systemEffective', {
                  theme: effectiveThemeLabel,
                })
              }}
            </p>
          </section>

          <section
            v-else-if="activeCategory === 'shortcuts'"
            data-testid="preferences-panel-shortcuts"
            class="flex h-full min-h-64 items-center justify-center text-center text-sm text-base-content/60"
          >
            {{ t('preferences.shortcutsPlaceholder') }}
          </section>

          <section v-else data-testid="preferences-panel-backup" class="max-w-xl">
            <p class="mb-4 text-sm text-base-content/70">
              {{ t('preferences.backup.description') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                data-testid="preferences-backup"
                class="btn btn-sm btn-primary"
                @click="emit('backupSettings')"
              >
                {{ t('preferences.backup.export') }}
              </button>
              <button
                data-testid="preferences-restore"
                class="btn btn-sm"
                @click="emit('restoreSettings')"
              >
                {{ t('preferences.backup.restore') }}
              </button>
            </div>
          </section>
        </main>
      </div>
    </section>
  </div>
</template>
