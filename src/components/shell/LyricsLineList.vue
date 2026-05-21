<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatTimestamp } from '../../core/utils/format-timestamp'
import { useEditorStore } from '../../stores/editor-store'
import type { LyricsEditorContext } from './injection-keys'
import { LYRICS_EDITOR_KEY } from './injection-keys'

const { t } = useI18n()
const store = useEditorStore()
const lyricsEditor = inject(LYRICS_EDITOR_KEY) as LyricsEditorContext

function isActive(lineId: string): boolean {
  const lyrics = store.project.lyrics
  if (lyrics.length === 0) return false
  const currentTime = store.currentTime
  for (let i = lyrics.length - 1; i >= 0; i--) {
    const line = lyrics[i]
    if (line.startTime !== undefined && line.startTime <= currentTime) {
      return line.id === lineId
    }
  }
  return false
}

function getLineText(line: { words: { text: string }[] }): string {
  return line.words.map((w) => w.text).join('')
}

function getWordStatus(line: {
  words: { endTime?: number }[]
  startTime?: number
}): string {
  if (line.startTime === undefined) return ''
  const total = line.words.length
  const timed = line.words.filter((w) => w.endTime !== undefined).length
  if (timed === total) return `${total}/${total}`
  return `${timed}/${total}`
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <header class="flex items-center border-b border-base-300 px-3 py-1.5 text-xs">
      <span class="opacity-70">{{ t('lyrics.lineList.title') }}</span>
    </header>

    <!-- Empty state -->
    <div
      v-if="store.project.lyrics.length === 0"
      class="flex flex-1 items-center justify-center text-sm opacity-40"
    >
      {{ t('lyrics.emptyHint') }}
    </div>

    <!-- Line list -->
    <ul v-else role="listbox" tabindex="0" class="min-h-0 flex-1 overflow-auto">
      <li
        v-for="(line, index) in store.project.lyrics"
        :key="line.id"
        data-testid="lyrics-line-row"
        role="option"
        :aria-selected="lyricsEditor.activeLineId.value === line.id"
        class="flex cursor-pointer items-center gap-3 border-b border-l-[3px] border-base-200 px-3 py-1.5 text-sm transition-colors hover:bg-base-200/80"
        :class="{
          'bg-primary/10': lyricsEditor.activeLineId.value === line.id,
          'border-l-success': isActive(line.id),
          'border-l-transparent': !isActive(line.id),
        }"
        @click="lyricsEditor.activateLine(line.id)"
      >
        <span class="w-6 text-xs opacity-40">{{ index + 1 }}</span>
        <span class="w-16 tabular-nums text-xs opacity-60">
          {{
            line.startTime !== undefined
              ? formatTimestamp(line.startTime)
              : t('lyrics.lineList.noStartTime')
          }}
        </span>
        <span class="min-w-0 flex-1 truncate">{{ getLineText(line) }}</span>
        <span class="w-10 text-right text-xs opacity-40">{{
          getWordStatus(line)
        }}</span>
      </li>
    </ul>
  </div>
</template>
