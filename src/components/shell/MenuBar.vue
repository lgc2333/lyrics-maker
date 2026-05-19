<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ mode: 'timing' | 'lyrics'; theme: 'light' | 'dark' }>()
const emit = defineEmits<{
  switchMode: [mode: 'timing' | 'lyrics']
  toggleTheme: []
  openAudioFile: []
}>()

const { t } = useI18n()

type MenuName = 'file' | 'edit' | 'view' | 'help'
const openMenu = ref<MenuName | null>(null)

function toggleMenu(name: MenuName): void {
  openMenu.value = openMenu.value === name ? null : name
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
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.newProject') }}
          </button>
          <button
            data-testid="menu-open-audio"
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
            @click="emit('openAudioFile')"
          >
            {{ t('shell.menu.openFile') }}
          </button>
          <div class="my-0.5 border-t border-base-300" />
          <button
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.save') }}
          </button>
          <button
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.saveAs') }}
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
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.undo') }}
          </button>
          <button
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.redo') }}
          </button>
        </div>
      </div>

      <div class="relative">
        <button
          data-testid="menu-trigger-view"
          aria-haspopup="true"
          :aria-expanded="openMenu === 'view'"
          class="rounded px-1.5 py-0.5 hover:bg-base-300"
          @click="toggleMenu('view')"
        >
          {{ t('shell.menu.view') }}
        </button>
        <div
          v-if="openMenu === 'view'"
          data-testid="menu-popup-view"
          role="menu"
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[120px] rounded border border-base-300 bg-base-100 shadow"
        >
          <button
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.zoomFit') }}
          </button>
          <button
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.zoomSelection') }}
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
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.shortcuts') }}
          </button>
          <button
            role="menuitem"
            class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
          >
            {{ t('shell.menu.about') }}
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
