<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <section data-testid="lyrics-panel" class="flex flex-1 border-t border-base-300">
    <!-- Left: Lyrics editing area -->
    <div class="flex-1 flex flex-col">
      <div class="flex items-center gap-2 border-b border-base-300 px-3 py-1.5 text-xs">
        <Icon icon="material-symbols:lyrics-rounded" class="text-sm" />
        <span>歌词编辑器</span>
        <span class="opacity-50">（歌词模式 · Pre Phase 3 骨架）</span>
      </div>
      <div class="flex-1 flex items-center justify-center opacity-40 text-sm">
        导入歌词或逐句输入以开始打轴
      </div>
    </div>

    <!-- Right: Controls sidebar -->
    <aside class="w-64 flex flex-col gap-3 border-l border-base-300 p-3 text-xs">
      <div class="opacity-70 font-medium">打轴控制</div>
      <div class="flex items-center gap-2">
        <Icon icon="material-symbols:metronome" class="text-sm opacity-50" />
        <span class="opacity-50">节拍器（占位）</span>
      </div>
      <div class="flex items-center gap-2">
        <Icon icon="material-symbols:magnet-rounded" class="text-sm opacity-50" />
        <span class="opacity-50">吸附开关（占位）</span>
      </div>
      <div class="mt-2 p-2 rounded bg-base-200/50 text-[11px] opacity-60">
        快捷键: D 打轴前进 | Shift+D 打轴 | Enter 下一行 | Ctrl+D 切词
      </div>
    </aside>
  </section>
</template>
