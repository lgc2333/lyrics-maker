<script setup lang="ts">
import { inject, nextTick, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LyricLine } from '../../core/domain/project'
import { formatTimestamp } from '../../core/utils/format-timestamp'
import { useEditorStore } from '../../stores/editor-store'
import type { LyricsEditorContext } from './injection-keys'
import { LYRICS_EDITOR_KEY } from './injection-keys'

const { t } = useI18n()
const store = useEditorStore()
const lyricsEditor = inject(LYRICS_EDITOR_KEY) as LyricsEditorContext
const lineElements = new Map<string, HTMLElement>()

function setLineElement(
  lineId: string,
  el: Element | ComponentPublicInstance | null,
): void {
  if (el instanceof HTMLElement) {
    lineElements.set(lineId, el)
  } else {
    lineElements.delete(lineId)
  }
}

watch(
  () => lyricsEditor.activeLineId.value,
  async (lineId) => {
    if (!lineId) return
    await nextTick()
    lineElements.get(lineId)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  },
)

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

function splitBySpaces(text: string): { text: string; isSpace: boolean }[] {
  const parts: { text: string; isSpace: boolean }[] = []
  for (const match of text.matchAll(/(\s+)|(\S+)/g)) {
    parts.push({ text: match[0], isSpace: match[1] !== undefined })
  }
  return parts
}

type WordTimingState = 'played' | 'playing' | 'unplayed'

function getWordTimingState(line: LyricLine, wordIndex: number): WordTimingState {
  if (line.startTime === undefined) return 'unplayed'
  const currentTime = store.currentTime
  const word = line.words[wordIndex]
  const wordStart =
    wordIndex === 0 ? line.startTime : line.words[wordIndex - 1]?.endTime

  if (wordStart === undefined) return 'unplayed'
  if (word.endTime !== undefined && word.endTime <= currentTime) return 'played'
  if (wordStart <= currentTime) return 'playing'
  return 'unplayed'
}

function getWordStatus(line: {
  words: { endTime?: number }[]
  startTime?: number
}): string {
  const total = line.words.length
  const timed = line.words.filter((w) => w.endTime !== undefined).length
  if (line.startTime === undefined && timed > 0) return ''
  if (timed === total) return `${total}/${total}`
  return `${timed}/${total}`
}

function hasIncompleteWordStatus(line: {
  words: { endTime?: number }[]
  startTime?: number
}): boolean {
  return (
    getWordStatus(line).length > 0 &&
    line.words.some((word) => word.endTime === undefined)
  )
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <!-- Line list -->
    <ul
      data-testid="lyrics-line-list"
      role="listbox"
      tabindex="0"
      class="min-h-0 flex-1 overflow-auto"
      @click="lyricsEditor.clearSelection()"
    >
      <li
        v-for="(line, index) in store.project.lyrics"
        :key="line.id"
        :ref="(el) => setLineElement(line.id, el)"
        data-testid="lyrics-line-row"
        role="option"
        :aria-selected="lyricsEditor.activeLineId.value === line.id"
        class="flex cursor-pointer items-center gap-3 border-b border-l-[3px] border-base-200 px-3 py-1.5 text-sm transition-colors hover:bg-base-200/80"
        :class="{
          'bg-primary/10': lyricsEditor.activeLineId.value === line.id,
          'border-l-success': isActive(line.id),
          'border-l-transparent': !isActive(line.id),
        }"
        @click.stop="lyricsEditor.activateLine(line.id)"
      >
        <span class="w-6 text-xs opacity-40">{{ index + 1 }}</span>
        <span class="w-16 tabular-nums text-xs opacity-60">
          {{
            line.startTime !== undefined
              ? formatTimestamp(line.startTime)
              : t('lyrics.lineList.noStartTime')
          }}
        </span>
        <span class="flex min-w-0 flex-1 items-center truncate">
          <template v-for="(word, wIdx) in line.words" :key="word.id">
            <span v-if="wIdx > 0" class="mx-px text-[12px] text-base-content/25"
              >|</span
            >
            <span
              :class="{
                'font-bold': getWordTimingState(line, wIdx) === 'playing',
                'opacity-50': getWordTimingState(line, wIdx) === 'unplayed',
              }"
              ><template v-for="(part, pIdx) in splitBySpaces(word.text)" :key="pIdx"
                ><span v-if="part.isSpace" class="text-[10px] text-base-content/50">{{
                  '␣'.repeat(part.text.length)
                }}</span
                ><template v-else>{{ part.text }}</template></template
              ></span
            >
          </template>
        </span>
        <span
          data-testid="lyrics-line-word-status"
          class="w-10 text-right text-xs"
          :class="
            hasIncompleteWordStatus(line)
              ? 'font-semibold text-warning opacity-100'
              : 'opacity-40'
          "
          >{{ getWordStatus(line) }}</span
        >
      </li>
    </ul>
  </div>
</template>
