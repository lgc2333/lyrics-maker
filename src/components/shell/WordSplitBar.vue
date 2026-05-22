<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { autoSplitText } from '../../core/lyrics/auto-split'
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
  if (lyricsEditor.splitBarMode.value !== 'timing') return
  lyricsEditor.activeWordIndex.value = index + 1
}

function onStartBlockClick(): void {
  if (lyricsEditor.splitBarMode.value !== 'timing') return
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

const editingWordId = ref<string | null>(null)
const editingWordText = ref('')
const wholeLineEditMode = ref(false)
const wholeLineText = ref('')

function onWordClickEdit(wordId: string, text: string): void {
  if (lyricsEditor.splitBarMode.value !== 'edit') return
  editingWordId.value = wordId
  editingWordText.value = text.trimEnd()
}

function confirmWordEdit(): void {
  if (!editingWordId.value || !activeLine.value) return
  const newText = editingWordText.value
  if (newText.length === 0) return
  const original = words.value.find((w) => w.id === editingWordId.value)
  const trailingSpace = original
    ? original.text.slice(original.text.trimEnd().length)
    : ''
  store.updateWordText(
    activeLine.value.id,
    editingWordId.value,
    newText + trailingSpace,
  )
  editingWordId.value = null
}

function cancelWordEdit(): void {
  editingWordId.value = null
}

function onGapClickInsert(insertIndex: number): void {
  if (lyricsEditor.splitBarMode.value !== 'edit' || !activeLine.value) return
  store.insertWord(activeLine.value.id, insertIndex, {
    id: crypto.randomUUID(),
    text: '',
  })
}

function enterWholeLineEdit(): void {
  if (!activeLine.value) return
  wholeLineEditMode.value = true
  wholeLineText.value = words.value.map((w) => w.text).join('')
}

function confirmWholeLineEdit(): void {
  if (!activeLine.value) return
  const tokens = autoSplitText(wholeLineText.value)
  const newWords = tokens.map((t) => ({
    id: crypto.randomUUID(),
    text: t,
  }))
  store.replaceLineWords(activeLine.value.id, newWords)
  wholeLineEditMode.value = false
}

function cancelWholeLineEdit(): void {
  wholeLineEditMode.value = false
}
</script>

<template>
  <div
    data-testid="word-split-bar"
    class="flex flex-col border-b border-base-300 px-3 py-2"
  >
    <!-- Mode toggle + word blocks -->
    <div class="flex items-center gap-2">
      <div class="join" data-testid="split-bar-mode-toggle">
        <button
          class="btn btn-xs join-item"
          :class="
            lyricsEditor.splitBarMode.value === 'cut' ? 'btn-warning' : 'btn-ghost'
          "
          :title="t('lyrics.wordSplitBar.cutMode')"
          @click="lyricsEditor.splitBarMode.value = 'cut'"
        >
          <Icon icon="material-symbols:content-cut" class="text-sm" />
        </button>
        <button
          class="btn btn-xs join-item"
          :class="
            lyricsEditor.splitBarMode.value === 'timing' ? 'btn-primary' : 'btn-ghost'
          "
          :title="t('lyrics.wordSplitBar.timingMode')"
          @click="lyricsEditor.splitBarMode.value = 'timing'"
        >
          <Icon icon="material-symbols:timer-outline" class="text-sm" />
        </button>
        <button
          class="btn btn-xs join-item"
          :class="lyricsEditor.splitBarMode.value === 'edit' ? 'btn-info' : 'btn-ghost'"
          :title="t('lyrics.wordSplitBar.editMode')"
          @click="lyricsEditor.splitBarMode.value = 'edit'"
        >
          <Icon icon="material-symbols:edit-outline" class="text-sm" />
        </button>
      </div>

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

        <!-- Timing mode: word blocks -->
        <template v-if="lyricsEditor.splitBarMode.value === 'timing'">
          <template v-for="(word, wIdx) in words" :key="word.id">
            <!-- Split line between words -->
            <div
              v-if="wIdx > 0"
              data-testid="split-line"
              class="flex h-5 w-3 cursor-pointer items-center justify-center"
              @click="onSplitLineClick(wIdx)"
            >
              <span
                v-if="/\s$/.test(words[wIdx - 1]?.text ?? '')"
                class="text-[10px] text-base-content/30"
                >&#x2423;</span
              >
              <div v-else class="h-full w-px transition-colors bg-base-300" />
            </div>

            <!-- Word block (click to activate) -->
            <div
              data-testid="word-block"
              class="cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors"
              :class="wordColor(wIdx)"
              @click="onWordClick(wIdx)"
            >
              {{ word.text || '&nbsp;' }}
            </div>
          </template>
        </template>

        <!-- Cut mode: individual characters with gap hotspots -->
        <template v-else-if="lyricsEditor.splitBarMode.value === 'cut'">
          <template v-for="(word, wIdx) in words" :key="word.id">
            <!-- Split line between words (clickable to merge) -->
            <div
              v-if="wIdx > 0"
              data-testid="split-line"
              class="flex h-5 w-3 cursor-pointer items-center justify-center"
              @click="onSplitLineClick(wIdx)"
            >
              <span
                v-if="/\s$/.test(words[wIdx - 1]?.text ?? '')"
                class="text-[10px] text-base-content/30"
                >&#x2423;</span
              >
              <div v-else class="h-full w-px transition-colors bg-warning" />
            </div>

            <div
              data-testid="word-block-cut"
              class="flex items-center rounded border transition-colors"
              :class="wordColor(wIdx)"
            >
              <template v-for="(char, cIdx) in word.text.split('')" :key="cIdx">
                <div
                  v-if="cIdx > 0"
                  data-testid="char-gap"
                  class="flex h-5 w-3 cursor-pointer items-center justify-center hover:bg-warning/20"
                  @click="onCharGapClick(wIdx, cIdx)"
                >
                  <div class="h-full w-px bg-transparent transition-colors" />
                </div>
                <span class="px-0.5 py-0.5 text-xs">{{ char }}</span>
              </template>
            </div>
          </template>
        </template>

        <!-- Edit mode: inline word editing -->
        <template
          v-else-if="lyricsEditor.splitBarMode.value === 'edit' && !wholeLineEditMode"
        >
          <button
            class="btn btn-xs btn-ghost"
            :title="t('lyrics.wordSplitBar.wholeLineEdit')"
            @click="enterWholeLineEdit"
          >
            <Icon icon="material-symbols:text-fields" class="text-sm" />
          </button>

          <div
            data-testid="start-block"
            class="rounded border px-1.5 py-0.5 text-xs opacity-40"
            :class="
              activeLine.startTime !== undefined
                ? 'bg-success/30 border-success'
                : 'bg-base-300/50 border-base-300'
            "
          >
            {{ t('lyrics.wordSplitBar.startBlock') }}
          </div>

          <template v-for="(word, wIdx) in words" :key="word.id">
            <div
              v-if="wIdx > 0"
              data-testid="edit-gap"
              class="flex h-5 w-3 cursor-pointer items-center justify-center hover:bg-info/20"
              @click="onGapClickInsert(wIdx)"
            >
              <span
                v-if="/\s$/.test(words[wIdx - 1]?.text ?? '')"
                class="text-[10px] text-base-content/30"
                >&#x2423;</span
              >
              <div v-else class="h-full w-px bg-base-300" />
            </div>

            <input
              v-if="editingWordId === word.id"
              v-model="editingWordText"
              class="input input-xs input-bordered w-16"
              @keydown.enter="confirmWordEdit"
              @keydown.escape="cancelWordEdit"
              @blur="confirmWordEdit"
            />

            <div
              v-else
              class="cursor-pointer rounded border border-info/30 bg-info/10 px-1.5 py-0.5 text-xs transition-colors hover:bg-info/20"
              @click="onWordClickEdit(word.id, word.text)"
            >
              {{ word.text.trimEnd() || '&nbsp;' }}
            </div>
          </template>
        </template>

        <!-- Whole-line edit mode -->
        <template
          v-else-if="lyricsEditor.splitBarMode.value === 'edit' && wholeLineEditMode"
        >
          <input
            v-model="wholeLineText"
            class="input input-xs input-bordered flex-1"
            @keydown.enter="confirmWholeLineEdit"
            @keydown.escape="cancelWholeLineEdit"
          />
          <button class="btn btn-xs btn-success" @click="confirmWholeLineEdit">
            <Icon icon="material-symbols:check" class="text-sm" />
          </button>
          <button class="btn btn-xs btn-ghost" @click="cancelWholeLineEdit">
            <Icon icon="material-symbols:close" class="text-sm" />
          </button>
        </template>
      </div>

      <div v-else class="flex-1 text-xs opacity-40">
        {{ t('lyrics.emptyHint') }}
      </div>
    </div>

    <!-- Numeric editor (timing mode only, when a word is active) -->
    <div
      v-if="
        lyricsEditor.splitBarMode.value === 'timing' &&
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
