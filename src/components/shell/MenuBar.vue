<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

defineProps<{ mode: 'timing' | 'lyrics' }>()
const emit = defineEmits<{ switchMode: [mode: 'timing' | 'lyrics'] }>()

type MenuName = 'file' | 'edit' | 'view' | 'help'
const openMenu = ref<MenuName | null>(null)

function toggleMenu(name: MenuName) {
  openMenu.value = openMenu.value === name ? null : name
}
</script>

<template>
  <header class="flex h-8 items-center border-b border-base-300 px-2 text-xs">
    <!-- App title -->
    <span class="font-semibold">歌词打轴软件</span>

    <!-- Menus -->
    <nav class="ml-3 flex gap-1">
      <div class="relative">
        <button
          data-testid="menu-trigger-file"
          class="cursor-pointer px-1 hover:bg-base-300 rounded"
          @click="toggleMenu('file')"
        >
          文件
        </button>
        <div
          v-if="openMenu === 'file'"
          data-testid="menu-popup-file"
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[120px] border border-base-300 bg-base-100 rounded shadow"
        >
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            新建项目
          </div>
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            打开文件...
          </div>
          <div class="border-t border-base-300 my-0.5"></div>
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            保存 (Ctrl+S)
          </div>
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            另存为...
          </div>
        </div>
      </div>

      <div class="relative">
        <button
          data-testid="menu-trigger-edit"
          class="cursor-pointer px-1 hover:bg-base-300 rounded"
          @click="toggleMenu('edit')"
        >
          编辑
        </button>
        <div
          v-if="openMenu === 'edit'"
          data-testid="menu-popup-edit"
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[140px] border border-base-300 bg-base-100 rounded shadow"
        >
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            撤销 (Ctrl+Z)
          </div>
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            重做 (Ctrl+Y)
          </div>
        </div>
      </div>

      <div class="relative">
        <button
          data-testid="menu-trigger-view"
          class="cursor-pointer px-1 hover:bg-base-300 rounded"
          @click="toggleMenu('view')"
        >
          查看
        </button>
        <div
          v-if="openMenu === 'view'"
          data-testid="menu-popup-view"
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[120px] border border-base-300 bg-base-100 rounded shadow"
        >
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            缩放至合适
          </div>
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            缩放至选区
          </div>
        </div>
      </div>

      <div class="relative">
        <button
          data-testid="menu-trigger-help"
          class="cursor-pointer px-1 hover:bg-base-300 rounded"
          @click="toggleMenu('help')"
        >
          帮助
        </button>
        <div
          v-if="openMenu === 'help'"
          data-testid="menu-popup-help"
          class="absolute left-0 top-full z-50 mt-0.5 min-w-[120px] border border-base-300 bg-base-100 rounded shadow"
        >
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">
            快捷键列表
          </div>
          <div class="px-2 py-1 hover:bg-base-200 cursor-pointer text-[11px]">关于</div>
        </div>
      </div>
    </nav>

    <!-- Right-side controls -->
    <div class="ml-auto flex items-center gap-2">
      <!-- Theme toggle -->
      <button
        data-testid="theme-toggle"
        class="cursor-pointer p-0.5 hover:bg-base-300 rounded"
      >
        <Icon icon="material-symbols:light-mode-rounded" class="text-sm" />
      </button>

      <!-- Mode switch -->
      <button
        data-testid="mode-switch-timing"
        class="cursor-pointer px-1 hover:bg-base-300 rounded"
        :class="{ 'font-bold underline': mode === 'timing' }"
        @click="emit('switchMode', 'timing')"
      >
        时轴
      </button>
      <button
        data-testid="mode-switch-lyrics"
        class="cursor-pointer px-1 hover:bg-base-300 rounded"
        :class="{ 'font-bold underline': mode === 'lyrics' }"
        @click="emit('switchMode', 'lyrics')"
      >
        歌词
      </button>
    </div>
  </header>
</template>
