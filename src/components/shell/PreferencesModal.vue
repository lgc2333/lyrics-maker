<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LocalLocale, LocalTheme } from '../../platform/settings/local-settings'
import { DEFAULT_SHORTCUT_BINDINGS } from '../../platform/shortcuts/defaults'
import type { ShortcutAction } from '../../platform/shortcuts/registry'
import ShortcutBindingRow from './ShortcutBindingRow.vue'

type Category = 'general' | 'shortcuts' | 'backup'

const props = defineProps<{
  localeMode: LocalLocale
  themeMode: LocalTheme
  effectiveTheme: 'light' | 'dark'
  shortcutBindings: Record<ShortcutAction, string | null>
  shortcutOverriddenActions: ReadonlySet<ShortcutAction>
  capturingAction: ShortcutAction | null
}>()

const emit = defineEmits<{
  close: []
  updateLocaleMode: [locale: LocalLocale]
  updateThemeMode: [theme: LocalTheme]
  backupSettings: []
  restoreSettings: []
  startCaptureShortcut: [action: ShortcutAction]
  cancelCaptureShortcut: []
  resetShortcut: [action: ShortcutAction]
  clearShortcut: [action: ShortcutAction]
  resetAllShortcuts: []
}>()

const { t } = useI18n()
const activeCategory = shallowRef<Category>('general')

const shortcutActions = Object.keys(DEFAULT_SHORTCUT_BINDINGS) as ShortcutAction[]

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
  { value: 'en-US', labelKey: 'preferences.locale.enUS' },
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
        <aside class="border-r border-base-300 bg-base-200/40 p-1.5">
          <button
            v-for="category in categories"
            :key="category.key"
            :data-testid="category.testid"
            class="mb-0.5 block w-full rounded px-2.5 py-1.5 text-left text-sm transition-colors"
            :class="
              activeCategory === category.key
                ? 'bg-base-100 font-semibold shadow-sm'
                : 'text-base-content/75 hover:bg-base-300/80 hover:text-base-content'
            "
            @click="activeCategory = category.key"
          >
            {{ t(category.labelKey) }}
          </button>
        </aside>

        <main class="min-h-0 overflow-auto">
          <section
            v-if="activeCategory === 'general'"
            data-testid="preferences-panel-general"
            class="flex flex-col p-2 gap-2"
          >
            <div
              data-testid="preferences-section-locale"
              class="rounded-lg border border-base-300 bg-base-200/40 p-4"
            >
              <h3 class="mb-1 text-sm font-semibold">
                {{ t('preferences.locale.title') }}
              </h3>
              <p class="mb-3 text-sm text-base-content/70">
                {{ t('preferences.locale.description') }}
              </p>
              <select
                data-testid="preferences-locale-select"
                class="select select-sm w-full max-w-xs"
                :aria-label="t('preferences.locale.title')"
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
            </div>

            <div
              data-testid="preferences-section-theme"
              class="rounded-lg border border-base-300 bg-base-200/40 p-4"
            >
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
                  :class="{
                    'btn-active btn-primary': props.themeMode === option.value,
                  }"
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
            </div>
          </section>

          <section
            v-else-if="activeCategory === 'shortcuts'"
            data-testid="preferences-panel-shortcuts"
            class="flex h-full flex-col p-2 gap-2"
          >
            <header class="flex shrink-0 items-center justify-between px-1">
              <p class="text-sm text-base-content/70">
                {{ t('preferences.shortcuts.description') }}
              </p>
              <button
                data-testid="preferences-shortcuts-reset-all"
                type="button"
                class="btn btn-ghost btn-sm"
                @click="emit('resetAllShortcuts')"
              >
                {{ t('preferences.shortcuts.resetAll') }}
              </button>
            </header>
            <ul
              data-testid="preferences-shortcuts-list"
              class="flex-1 overflow-auto rounded border border-base-300 p-2"
            >
              <ShortcutBindingRow
                v-for="action in shortcutActions"
                :key="action"
                :action="action"
                :effective-keystroke="props.shortcutBindings[action]"
                :is-overridden="props.shortcutOverriddenActions.has(action)"
                :capturing="props.capturingAction === action"
                @start-capture="(a) => emit('startCaptureShortcut', a)"
                @cancel-capture="emit('cancelCaptureShortcut')"
                @reset="(a) => emit('resetShortcut', a)"
                @clear="(a) => emit('clearShortcut', a)"
              />
            </ul>
          </section>

          <section
            v-else
            data-testid="preferences-panel-backup"
            class="flex flex-col p-2 gap-2"
          >
            <div
              data-testid="preferences-section-backup"
              class="rounded-lg border border-base-300 bg-base-200/40 p-4"
            >
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
            </div>
          </section>
        </main>
      </div>
    </section>
  </div>
</template>
