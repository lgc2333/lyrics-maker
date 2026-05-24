<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    mode: 'timing' | 'lyrics'
    theme: 'light' | 'dark'
    audioLoaded?: boolean
    canUndo?: boolean
    canRedo?: boolean
    nextUndoLabel?: string | null
    nextRedoLabel?: string | null
  }>(),
  {
    audioLoaded: false,
    canUndo: false,
    canRedo: false,
    nextUndoLabel: null,
    nextRedoLabel: null,
  },
)
const emit = defineEmits<{
  switchMode: [mode: 'timing' | 'lyrics']
  toggleTheme: []
  openAudioFile: []
  pasteLyrics: []
  importLyricsFile: []
  addLyricLine: []
  undo: []
  redo: []
}>()

const { t, te } = useI18n()

type MenuName = 'file' | 'edit' | 'help' | 'lyrics'
const openMenu = ref<MenuName | null>(null)

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

function toggleMenu(name: MenuName): void {
  openMenu.value = openMenu.value === name ? null : name
}

function onMenuHover(name: MenuName): void {
  if (openMenu.value !== null && openMenu.value !== name) {
    openMenu.value = name
  }
}

function closeMenu(): void {
  openMenu.value = null
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
    !target.closest('[data-testid^="menu-popup-"]')
  ) {
    openMenu.value = null
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick, true))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true))
</script>

<template>
  <header
    class="grid h-8 grid-cols-[1fr_auto_1fr] items-center border-b border-base-300 px-2 text-xs"
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
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[120px] rounded border border-base-300 bg-base-100 shadow"
        >
          <button
            data-testid="menu-new-project"
            role="menuitem"
            disabled
            class="block w-full cursor-not-allowed px-2 py-1 text-left text-[11px] opacity-50"
          >
            {{ t('shell.menu.newProject') }}
          </button>
          <button
            data-testid="menu-open-project"
            role="menuitem"
            disabled
            class="block w-full cursor-not-allowed px-2 py-1 text-left text-[11px] opacity-50"
          >
            {{ t('shell.menu.openProject') }}
          </button>
          <button
            data-testid="menu-open-audio"
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
            @click="(emit('openAudioFile'), closeMenu())"
          >
            {{ t('shell.menu.openAudio') }}
          </button>
          <div class="my-0.5 border-t border-base-300" />
          <button
            data-testid="menu-save-project"
            role="menuitem"
            disabled
            class="block w-full cursor-not-allowed px-2 py-1 text-left text-[11px] opacity-50"
          >
            {{ t('shell.menu.saveProject') }}
          </button>
          <button
            data-testid="menu-save-as"
            role="menuitem"
            disabled
            class="block w-full cursor-not-allowed px-2 py-1 text-left text-[11px] opacity-50"
          >
            {{ t('shell.menu.saveAs') }}
          </button>
          <div class="my-0.5 border-t border-base-300" />
          <button
            data-testid="menu-preferences"
            role="menuitem"
            disabled
            class="block w-full cursor-not-allowed px-2 py-1 text-left text-[11px] opacity-50"
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
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[140px] rounded border border-base-300 bg-base-100 shadow"
        >
          <button
            data-testid="menu-undo"
            role="menuitem"
            :disabled="!props.canUndo"
            class="block w-full px-2 py-1 text-left text-[11px]"
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
            class="block w-full px-2 py-1 text-left text-[11px]"
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
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[120px] rounded border border-base-300 bg-base-100 shadow"
        >
          <button
            data-testid="menu-about"
            role="menuitem"
            disabled
            class="block w-full cursor-not-allowed px-2 py-1 text-left text-[11px] opacity-50"
          >
            {{ t('shell.menu.about') }}
          </button>
        </div>
      </div>

      <div class="relative">
        <button
          data-testid="menu-trigger-lyrics"
          aria-haspopup="true"
          :aria-expanded="openMenu === 'lyrics'"
          class="rounded px-1.5 py-0.5 hover:bg-base-300"
          @click="toggleMenu('lyrics')"
          @mouseenter="onMenuHover('lyrics')"
        >
          {{ t('shell.menu.lyrics') }}
        </button>
        <div
          v-if="openMenu === 'lyrics'"
          data-testid="menu-popup-lyrics"
          role="menu"
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[140px] rounded border border-base-300 bg-base-100 shadow"
        >
          <button
            data-testid="menu-paste-lyrics"
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
            @click="(emit('pasteLyrics'), (openMenu = null))"
          >
            {{ t('shell.menu.pasteLyrics') }}
          </button>
          <button
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
            @click="(emit('importLyricsFile'), (openMenu = null))"
          >
            {{ t('shell.menu.importLyricsFile') }}
          </button>
          <div class="my-0.5 border-t border-base-300" />
          <button
            data-testid="menu-add-lyric-line"
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
            @click="(emit('addLyricLine'), (openMenu = null))"
          >
            {{ t('shell.menu.addLyricLine') }}
          </button>
        </div>
      </div>
    </nav>

    <div data-testid="menu-title" class="justify-self-center text-sm font-semibold">
      {{ t('shell.appTitle') }}
    </div>

    <div
      data-testid="menu-right"
      class="ml-auto flex items-center gap-2 justify-self-end"
    >
      <button
        data-testid="theme-toggle"
        class="btn btn-ghost btn-xs btn-square"
        @click="emit('toggleTheme')"
      >
        <Icon
          :icon="
            theme === 'dark'
              ? 'material-symbols:dark-mode-rounded'
              : 'material-symbols:light-mode-rounded'
          "
          class="text-sm"
        />
      </button>

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
