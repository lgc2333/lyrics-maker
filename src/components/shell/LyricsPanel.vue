<script setup lang="ts">
import LyricsLineList from './LyricsLineList.vue'
import WordSplitBar from './WordSplitBar.vue'
</script>

<template>
  <section
    data-testid="lyrics-panel"
    class="flex flex-1 flex-col border-t border-base-300"
  >
    <div class="min-h-0 flex-1 overflow-hidden">
      <LyricsLineList />
    </div>
    <WordSplitBar />
  </section>
</template>
