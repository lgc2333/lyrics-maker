<script setup lang="ts">
import { shallowRef } from 'vue'

// TODO Phase 2: read mode from editorStore, remove local shallowRef
const mode = shallowRef<'timing' | 'lyrics'>('timing')
</script>

<template>
  <section class="flex-1 border-t border-base-300 p-4">
    <h2 class="text-sm font-semibold">
      {{ mode === 'timing' ? '时轴模式（占位）' : '歌词模式（占位）' }}
    </h2>
    <p class="text-xs opacity-70">Phase 1 仅提供基础骨架，不包含时轴功能实现。</p>
  </section>
</template>
