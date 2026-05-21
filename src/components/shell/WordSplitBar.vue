<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatTimestamp } from '../../core/utils/format-timestamp'
import { useEditorStore } from '../../stores/editor-store'
import type { LyricsEditorContext } from './injection-keys'
import { LYRICS_EDITOR_KEY } from './injection-keys'

const { t } = useI18n()
const store = useEditorStore()
const lyricsEditor = inject(LYRICS_EDITOR_KEY) as LyricsEditorContext

const activeLine = computed(() => lyricsEditor.activeLine.value)

const words = computed(() => activeLine.value?.words ?? [])

function wordColor(index: number): string {
  const wordIdx = index + 1 // +1 because index 0 is startBlock
  if (wordIdx === lyricsEditor.activeWordIndex.value) return 'bg-error/30 border-error'
  const word = words.value[index]
  if (word?.endTime !== undefined) return 'bg-success/30 border-success'
  return 'bg-base-300/50 border-base-300'
}

function isStartBlockActive(): boolean {
  return lyricsEditor.activeWordIndex.value === 0
}

function getDerivedStartTime(index: number): number | undefined {
  if (index === 0) return activeLine.value?.startTime
  return words.value[index - 1]?.endTime
}

function onWordClick(index: number): void {
  if (lyricsEditor.splitBarMode.value !== 'select') return
  lyricsEditor.activeWordIndex.value = index + 1
}

function onStartBlockClick(): void {
  if (lyricsEditor.splitBarMode.value !== 'select') return
  lyricsEditor.activeWordIndex.value = 0
}

function onCharGapClick(wordIndex: number, charIndex: number): void {
  if (lyricsEditor.splitBarMode.value !== 'cut') return
  const word = words.value[wordIndex]
  if (!word || charIndex <= 0 || charIndex >= word.text.length) return
  store.splitWord(activeLine.value!.id, word.id, charIndex)

  if (word.endTime !== undefined) {
    const prevEnd =
      wordIndex === 0
        ? activeLine.value?.startTime
        : words.value[wordIndex - 1]?.endTime
    if (prevEnd !== undefined) {
      const midpoint = (prevEnd + word.endTime) / 2
      const updatedLine = store.project.lyrics.find(
        (l) => l.id === activeLine.value!.id,
      )
      if (updatedLine) {
        const frontWord = updatedLine.words[wordIndex]
        if (frontWord && frontWord.endTime === undefined) {
          store.setWordEndTime(activeLine.value!.id, frontWord.id, midpoint)
        }
      }
    }
  }
}

function onSplitLineClick(wordIndex: number): void {
  if (lyricsEditor.splitBarMode.value !== 'cut') return
  if (wordIndex <= 0) return
  const prevWord = words.value[wordIndex - 1]
  if (!prevWord) return
  store.mergeWords(activeLine.value!.id, prevWord.id)
}

function onEndTimeInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const value = Number.parseFloat(input.value)
  if (!Number.isFinite(value) || !activeLine.value) return
  const wordIndex = lyricsEditor.activeWordIndex.value - 1
  const word = words.value[wordIndex]
  if (!word) return
  store.setWordEndTime(activeLine.value.id, word.id, Math.max(0, value))
}
</script>

<template>
  <div
    data-testid="word-split-bar"
    class="flex flex-col border-t border-base-300 px-3 py-2"
  >
    <!-- Mode toggle + word blocks -->
    <div class="flex items-center gap-2">
      <button
        data-testid="split-bar-mode-toggle"
        class="btn btn-xs btn-square"
        :class="lyricsEditor.splitBarMode.value === 'cut' ? 'btn-warning' : 'btn-ghost'"
        @click="
          lyricsEditor.splitBarMode.value =
            lyricsEditor.splitBarMode.value === 'cut' ? 'select' : 'cut'
        "
      >
        <Icon
          :icon="
            lyricsEditor.splitBarMode.value === 'cut'
              ? 'material-symbols:content-cut'
              : 'material-symbols:touch-app-rounded'
          "
          class="text-sm"
        />
      </button>

      <div
        v-if="activeLine"
        class="flex flex-1 flex-wrap items-center gap-0.5 overflow-auto"
      >
        <!-- Start block -->
        <div
          data-testid="start-block"
          class="cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors"
          :class="
            isStartBlockActive()
              ? 'bg-error/30 border-error'
              : activeLine.startTime !== undefined
                ? 'bg-success/30 border-success'
                : 'bg-base-300/50 border-base-300'
          "
          @click="onStartBlockClick"
        >
          {{ t('lyrics.wordSplitBar.startBlock') }}
        </div>

        <!-- Word blocks -->
        <template v-for="(word, wIdx) in words" :key="word.id">
          <!-- Split line between words (clickable to merge in cut mode) -->
          <div
            v-if="wIdx > 0"
            data-testid="split-line"
            class="h-5 w-px cursor-pointer transition-colors"
            :class="
              lyricsEditor.splitBarMode.value === 'cut'
                ? 'bg-warning hover:bg-error'
                : 'bg-base-300'
            "
            @click="onSplitLineClick(wIdx)"
          />

          <!-- Word block (in select mode: click to activate) -->
          <div
            v-if="lyricsEditor.splitBarMode.value === 'select'"
            data-testid="word-block"
            class="cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors"
            :class="wordColor(wIdx)"
            @click="onWordClick(wIdx)"
          >
            {{ word.text || '&nbsp;' }}
          </div>

          <!-- Cut mode: individual characters with gap hotspots -->
          <div
            v-else
            data-testid="word-block-cut"
            class="flex items-center rounded border transition-colors"
            :class="wordColor(wIdx)"
          >
            <template v-for="(char, cIdx) in word.text.split('')" :key="cIdx">
              <div
                v-if="cIdx > 0"
                data-testid="char-gap"
                class="h-5 w-px cursor-pointer bg-transparent hover:bg-warning"
                @click="onCharGapClick(wIdx, cIdx)"
              />
              <span class="px-0.5 py-0.5 text-xs">{{ char }}</span>
            </template>
          </div>
        </template>
      </div>

      <div v-else class="flex-1 text-xs opacity-40">
        {{ t('lyrics.emptyHint') }}
      </div>
    </div>

    <!-- Numeric editor (select mode only, when a word is active) -->
    <div
      v-if="
        lyricsEditor.splitBarMode.value === 'select' &&
        activeLine &&
        lyricsEditor.activeWordIndex.value > 0 &&
        lyricsEditor.activeWordIndex.value <= words.length
      "
      data-testid="numeric-editor"
      class="mt-1.5 flex items-center gap-3 text-xs"
    >
      <span class="opacity-50">{{ t('lyrics.wordSplitBar.derivedStartLabel') }}:</span>
      <span class="tabular-nums">
        {{
          getDerivedStartTime(lyricsEditor.activeWordIndex.value - 1) !== undefined
            ? formatTimestamp(
                getDerivedStartTime(lyricsEditor.activeWordIndex.value - 1)!,
              )
            : '--:--'
        }}
      </span>
      <span class="opacity-50">{{ t('lyrics.wordSplitBar.endTimeLabel') }}:</span>
      <input
        type="number"
        step="0.001"
        class="input input-xs input-bordered w-24 tabular-nums"
        :value="words[lyricsEditor.activeWordIndex.value - 1]?.endTime ?? ''"
        placeholder="--:--"
        @change="onEndTimeInput($event)"
      />
    </div>
  </div>
</template>
