<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LyricsExportTargetId } from '../../core/lyrics-io/types'
import { COMMAND_LABEL_KEYS } from '../../i18n/status-label-maps'
import type { LocalTheme } from '../../platform/settings/local-settings'

const props = withDefaults(
  defineProps<{
    mode: 'timing' | 'lyrics'
    theme?: 'light' | 'dark'
    themeMode?: LocalTheme
    effectiveTheme?: 'light' | 'dark'
    audioLoaded?: boolean
    canUndo?: boolean
    canRedo?: boolean
    nextUndoLabel?: string | null
    nextRedoLabel?: string | null
    projectTitle?: string
    dirty?: boolean
  }>(),
  {
    audioLoaded: false,
    canUndo: false,
    canRedo: false,
    nextUndoLabel: null,
    nextRedoLabel: null,
    projectTitle: 'Untitled Project',
    dirty: false,
  },
)
const emit = defineEmits<{
  switchMode: [mode: 'timing' | 'lyrics']
  toggleTheme: []
  updateThemeMode: [theme: LocalTheme]
  newProject: []
  openProject: []
  openAudioFile: []
  saveProject: []
  saveProjectAs: []
  pasteLyrics: []
  importLyricsFile: []
  exportLyricsFile: [target: LyricsExportTargetId]
  validateProject: []
  addLyricLine: []
  undo: []
  redo: []
  openPreferences: []
  updateProjectTitle: [title: string]
}>()

const { t, te } = useI18n()

type MenuName = 'file' | 'edit' | 'help'
const openMenu = ref<MenuName | null>(null)
const openFileSubmenu = ref<'exportLyrics' | null>(null)
const themeMenuOpen = ref(false)
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

const displayedProjectTitle = computed(
  () => `${props.dirty ? '*' : ''}${props.projectTitle} - ${t('shell.appTitle')}`,
)

const themeMode = computed<LocalTheme>(() => props.themeMode ?? props.theme ?? 'light')
const effectiveTheme = computed<'light' | 'dark'>(
  () => props.effectiveTheme ?? props.theme ?? 'light',
)

const themeOptions: Array<{ value: LocalTheme; labelKey: string; testid: string }> = [
  { value: 'light', labelKey: 'preferences.theme.light', testid: 'theme-option-light' },
  { value: 'dark', labelKey: 'preferences.theme.dark', testid: 'theme-option-dark' },
  {
    value: 'system',
    labelKey: 'preferences.theme.system',
    testid: 'theme-option-system',
  },
]

const lyricExportTargets: Array<{
  id: LyricsExportTargetId
  labelKey: string
  warningKey?: string
}> = [
  { id: 'lrc-enhanced', labelKey: 'lyrics.export.formats.lrcEnhanced' },
  { id: 'lrc-eslyric', labelKey: 'lyrics.export.formats.lrcEslyric' },
  { id: 'ttml', labelKey: 'lyrics.export.formats.ttml' },
  { id: 'ass', labelKey: 'lyrics.export.formats.ass' },
  {
    id: 'lrc-line',
    labelKey: 'lyrics.export.formats.lrcLine',
    warningKey: 'lyrics.export.loss.wordTiming',
  },
  {
    id: 'srt',
    labelKey: 'lyrics.export.formats.srt',
    warningKey: 'lyrics.export.loss.wordTiming',
  },
  {
    id: 'vtt',
    labelKey: 'lyrics.export.formats.vtt',
    warningKey: 'lyrics.export.loss.wordTiming',
  },
  {
    id: 'txt',
    labelKey: 'lyrics.export.formats.txt',
    warningKey: 'lyrics.export.loss.allTiming',
  },
]

const themeButtonTitle = computed(() => {
  if (themeMode.value !== 'system') {
    return t(`preferences.theme.${themeMode.value}`)
  }
  return `${t('preferences.theme.system')} (${t(`preferences.theme.${effectiveTheme.value}`)})`
})

const themeIcon = computed(() => {
  if (themeMode.value === 'system') return 'material-symbols:desktop-windows-rounded'
  return effectiveTheme.value === 'dark'
    ? 'material-symbols:dark-mode-rounded'
    : 'material-symbols:light-mode-rounded'
})

function toggleMenu(name: MenuName): void {
  themeMenuOpen.value = false
  openFileSubmenu.value = null
  openMenu.value = openMenu.value === name ? null : name
}

function onMenuHover(name: MenuName): void {
  if (themeMenuOpen.value) {
    themeMenuOpen.value = false
    openMenu.value = name
    return
  }
  if (openMenu.value !== null && openMenu.value !== name) {
    openMenu.value = name
  }
}

function closeMenu(): void {
  openMenu.value = null
  openFileSubmenu.value = null
  themeMenuOpen.value = false
}

function toggleThemeMenu(): void {
  openMenu.value = null
  themeMenuOpen.value = !themeMenuOpen.value
}

function selectThemeMode(nextThemeMode: LocalTheme): void {
  emit('updateThemeMode', nextThemeMode)
  themeMenuOpen.value = false
}

function openExportSubmenu(): void {
  openFileSubmenu.value = 'exportLyrics'
}

function closeFileSubmenu(): void {
  openFileSubmenu.value = null
}

async function startTitleEdit(): Promise<void> {
  titleDraft.value = props.projectTitle
  editingTitle.value = true
  await nextTick()
  titleInput.value?.focus()
  titleInput.value?.select()
}

function commitTitleEdit(): void {
  if (!editingTitle.value) return
  editingTitle.value = false
  emit('updateProjectTitle', titleDraft.value)
}

function cancelTitleEdit(): void {
  editingTitle.value = false
  titleDraft.value = props.projectTitle
}

function translateCommandLabel(label: string | null | undefined): string {
  if (!label) return ''
  const key = COMMAND_LABEL_KEYS[label]
  return key && te(key) ? t(key) : label
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function') return
  if (
    !target.closest('[data-testid^="menu-trigger-"]') &&
    !target.closest('[data-testid="theme-toggle"]') &&
    !target.closest('[data-testid^="menu-popup-"]')
  ) {
    openMenu.value = null
    openFileSubmenu.value = null
    themeMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick, true))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true))
</script>

<template>
  <header
    class="grid h-9 grid-cols-[1fr_auto_1fr] items-center border-b border-base-300 px-2 text-sm"
  >
    <nav data-testid="menu-left" role="menubar" class="flex items-center gap-1">
      <div class="relative">
        <button
          data-testid="menu-trigger-file"
          aria-haspopup="true"
          :aria-expanded="openMenu === 'file'"
          class="rounded px-1.5 py-0.5 hover:bg-base-300"
          @click="toggleMenu('file')"
          @mouseenter="onMenuHover('file')"
        >
          {{ t('shell.menu.file') }}
        </button>
        <div
          v-if="openMenu === 'file'"
          data-testid="menu-popup-file"
          role="menu"
          class="absolute left-0 top-full z-50 mt-0.5 w-max min-w-[120px] rounded border border-base-300 bg-base-100 shadow text-sm"
        >
          <button
            data-testid="menu-new-project"
            role="menuitem"
            class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
            @mouseenter="closeFileSubmenu"
            @click="(emit('newProject'), closeMenu())"
          >
            {{ t('shell.menu.newProject') }}
          </button>
          <button
            data-testid="menu-open-project"
            role="menuitem"
            class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
            @mouseenter="closeFileSubmenu"
            @click="(emit('openProject'), closeMenu())"
          >
            {{ t('shell.menu.openProject') }}
          </button>
          <button
            data-testid="menu-open-audio"
            role="menuitem"
            class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
            @mouseenter="closeFileSubmenu"
            @click="(emit('openAudioFile'), closeMenu())"
          >
            {{ t('shell.menu.openAudio') }}
          </button>
          <button
            data-testid="menu-import-lyrics"
            role="menuitem"
            class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
            @mouseenter="closeFileSubmenu"
            @click="(emit('importLyricsFile'), closeMenu())"
          >
            {{ t('shell.menu.importLyrics') }}
          </button>
          <div class="relative">
            <button
              data-testid="menu-export-lyrics"
              role="menuitem"
              aria-haspopup="true"
              :aria-expanded="openFileSubmenu === 'exportLyrics'"
              class="flex w-full cursor-pointer items-center justify-between gap-4 whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
              @mouseenter="openExportSubmenu"
            >
              <span>{{ t('shell.menu.exportLyrics') }}</span>
              <Icon icon="material-symbols:chevron-right-rounded" class="text-sm" />
            </button>
            <div
              v-if="openFileSubmenu === 'exportLyrics'"
              data-testid="menu-popup-export-lyrics"
              role="menu"
              class="absolute left-full top-0 z-50 ml-0.5 w-max min-w-[180px] rounded border border-base-300 bg-base-100 shadow text-sm"
            >
              <button
                v-for="target in lyricExportTargets"
                :key="target.id"
                :data-testid="`menu-export-lyrics-${target.id}`"
                role="menuitem"
                class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
                @click="(emit('exportLyricsFile', target.id), closeMenu())"
              >
                {{ t(target.labelKey) }}
                <span v-if="target.warningKey" class="text-warning">
                  （{{ t(target.warningKey) }}）
                </span>
              </button>
            </div>
          </div>
          <button
            data-testid="menu-validate-project"
            role="menuitem"
            class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
            @mouseenter="closeFileSubmenu"
            @click="(emit('validateProject'), closeMenu())"
          >
            {{ t('shell.menu.validateProject') }}
          </button>
          <div class="my-0.5 border-t border-base-300" />
          <button
            data-testid="menu-save-project"
            role="menuitem"
            class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
            @mouseenter="closeFileSubmenu"
            @click="(emit('saveProject'), closeMenu())"
          >
            {{ t('shell.menu.saveProject') }}
          </button>
          <button
            data-testid="menu-save-as"
            role="menuitem"
            class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
            @mouseenter="closeFileSubmenu"
            @click="(emit('saveProjectAs'), closeMenu())"
          >
            {{ t('shell.menu.saveAs') }}
          </button>
          <div class="my-0.5 border-t border-base-300" />
          <button
            data-testid="menu-preferences"
            role="menuitem"
            class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
            @mouseenter="closeFileSubmenu"
            @click="(emit('openPreferences'), closeMenu())"
          >
            {{ t('shell.menu.preferences') }}
          </button>
        </div>
      </div>

      <div class="relative">
        <button
          data-testid="menu-trigger-edit"
          aria-haspopup="true"
          :aria-expanded="openMenu === 'edit'"
          class="rounded px-1.5 py-0.5 hover:bg-base-300"
          @click="toggleMenu('edit')"
          @mouseenter="onMenuHover('edit')"
        >
          {{ t('shell.menu.edit') }}
        </button>
        <div
          v-if="openMenu === 'edit'"
          data-testid="menu-popup-edit"
          role="menu"
          class="absolute left-0 top-full z-50 mt-0.5 w-max min-w-[140px] rounded border border-base-300 bg-base-100 shadow text-sm"
        >
          <button
            data-testid="menu-undo"
            role="menuitem"
            :disabled="!props.canUndo"
            class="block w-full whitespace-nowrap px-2 py-1 text-left"
            :class="
              props.canUndo
                ? 'cursor-pointer hover:bg-base-200'
                : 'cursor-not-allowed opacity-50'
            "
            @click="(emit('undo'), closeMenu())"
          >
            {{ t('shell.menu.undo') }}
            <span v-if="props.nextUndoLabel">
              : {{ translateCommandLabel(props.nextUndoLabel) }}
            </span>
          </button>
          <button
            data-testid="menu-redo"
            role="menuitem"
            :disabled="!props.canRedo"
            class="block w-full whitespace-nowrap px-2 py-1 text-left"
            :class="
              props.canRedo
                ? 'cursor-pointer hover:bg-base-200'
                : 'cursor-not-allowed opacity-50'
            "
            @click="(emit('redo'), closeMenu())"
          >
            {{ t('shell.menu.redo') }}
            <span v-if="props.nextRedoLabel">
              : {{ translateCommandLabel(props.nextRedoLabel) }}
            </span>
          </button>
        </div>
      </div>

      <div class="relative">
        <button
          data-testid="menu-trigger-help"
          aria-haspopup="true"
          :aria-expanded="openMenu === 'help'"
          class="rounded px-1.5 py-0.5 hover:bg-base-300"
          @click="toggleMenu('help')"
          @mouseenter="onMenuHover('help')"
        >
          {{ t('shell.menu.help') }}
        </button>
        <div
          v-if="openMenu === 'help'"
          data-testid="menu-popup-help"
          role="menu"
          class="absolute left-0 top-full z-50 mt-0.5 w-max min-w-[120px] rounded border border-base-300 bg-base-100 shadow text-sm"
        >
          <button
            data-testid="menu-about"
            role="menuitem"
            disabled
            class="block w-full cursor-not-allowed whitespace-nowrap px-2 py-1 text-left opacity-50"
          >
            {{ t('shell.menu.about') }}
          </button>
        </div>
      </div>
    </nav>

    <div data-testid="menu-title" class="justify-self-center text-sm">
      <input
        v-if="editingTitle"
        ref="titleInput"
        v-model="titleDraft"
        data-testid="menu-title-input"
        class="input input-xs h-6 w-96 text-center text-sm"
        @blur="commitTitleEdit"
        @keydown.enter.prevent="commitTitleEdit"
        @keydown.escape.prevent="cancelTitleEdit"
      />
      <button
        v-else
        data-testid="menu-title-button"
        class="rounded px-2 py-0.5 hover:bg-base-300"
        @click="startTitleEdit"
      >
        {{ displayedProjectTitle }}
      </button>
    </div>

    <div
      data-testid="menu-right"
      class="ml-auto flex items-center gap-2 justify-self-end"
    >
      <button
        data-testid="theme-toggle"
        aria-haspopup="true"
        :aria-expanded="themeMenuOpen"
        :title="themeButtonTitle"
        class="btn btn-ghost btn-xs btn-square"
        @click="toggleThemeMenu"
      >
        <Icon :icon="themeIcon" class="text-sm" />
      </button>
      <div
        v-if="themeMenuOpen"
        data-testid="menu-popup-theme"
        role="menu"
        class="absolute top-7 right-2 z-50 mt-0.5 w-max min-w-[120px] rounded border border-base-300 bg-base-100 shadow text-sm"
      >
        <button
          v-for="option in themeOptions"
          :key="option.value"
          :data-testid="option.testid"
          role="menuitemradio"
          :aria-checked="themeMode === option.value"
          class="block w-full cursor-pointer whitespace-nowrap px-2 py-1 text-left hover:bg-base-200"
          :class="{ 'bg-base-200 font-semibold': themeMode === option.value }"
          @click="selectThemeMode(option.value)"
        >
          {{ t(option.labelKey) }}
        </button>
      </div>

      <div
        data-testid="mode-switch-group"
        class="inline-flex items-center rounded-md bg-base-300 p-0.5"
      >
        <button
          data-testid="mode-switch-timing"
          class="rounded px-2 py-0.5 transition-colors"
          :class="
            mode === 'timing'
              ? 'bg-base-100 font-semibold shadow'
              : 'text-base-content/70 hover:text-base-content'
          "
          @click="emit('switchMode', 'timing')"
        >
          {{ t('shell.mode.timing') }}
        </button>
        <button
          data-testid="mode-switch-lyrics"
          class="rounded px-2 py-0.5 transition-colors"
          :class="
            mode === 'lyrics'
              ? 'bg-base-100 font-semibold shadow'
              : 'text-base-content/70 hover:text-base-content'
          "
          @click="emit('switchMode', 'lyrics')"
        >
          {{ t('shell.mode.lyrics') }}
        </button>
      </div>
    </div>
  </header>
</template>
