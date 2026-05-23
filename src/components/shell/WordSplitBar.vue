<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, inject, nextTick, ref } from 'vue'
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
const wholeLineInputRef = ref<HTMLInputElement | null>(null)

function onWordClickEdit(wordId: string, text: string): void {
  if (lyricsEditor.splitBarMode.value !== 'edit') return
  editingWordId.value = wordId
  editingWordText.value = text.trimEnd()
}

function onRemoveWord(wordId: string): void {
  if (lyricsEditor.splitBarMode.value !== 'edit' || !activeLine.value) return
  if (editingWordId.value === wordId) editingWordId.value = null
  store.removeWord(activeLine.value.id, wordId)
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

async function enterWholeLineEdit(): Promise<void> {
  if (!activeLine.value) return
  wholeLineEditMode.value = true
  wholeLineText.value = words.value.map((w) => w.text).join('')
  await nextTick()
  wholeLineInputRef.value?.focus()
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

function splitBySpaces(text: string): { text: string; isSpace: boolean }[] {
  const parts: { text: string; isSpace: boolean }[] = []
  for (const match of text.matchAll(/(\s+)|(\S+)/g)) {
    parts.push({ text: match[0], isSpace: match[1] !== undefined })
  }
  return parts
}
</script>

<template>
  <div
    data-testid="word-split-bar"
    class="flex flex-col border-b border-base-300 px-2 py-2"
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

      <div v-if="activeLine" class="flex flex-1 flex-wrap items-center gap-0.5">
        <!-- Start block (timing mode only) -->
        <div
          v-if="lyricsEditor.splitBarMode.value === 'timing'"
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
            <!-- Word block (click to activate) -->
            <div
              data-testid="word-block"
              class="cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors"
              :class="wordColor(wIdx)"
              @click="onWordClick(wIdx)"
            >
              <template v-for="(part, pIdx) in splitBySpaces(word.text)" :key="pIdx"
                ><span v-if="part.isSpace" class="text-[10px] text-base-content/30">{{
                  '␣'.repeat(part.text.length)
                }}</span
                ><template v-else>{{ part.text }}</template></template
              ><template v-if="!word.text">&nbsp;</template>
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
              class="flex h-4 w-1.5 cursor-pointer items-center justify-center"
              @click="onSplitLineClick(wIdx)"
            >
              <div class="h-full w-px transition-colors bg-warning" />
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
                  class="flex h-5 w-1.5 cursor-pointer items-center justify-center hover:bg-warning/20"
                  @click="onCharGapClick(wIdx, cIdx)"
                >
                  <div class="h-full w-px bg-transparent transition-colors" />
                </div>
                <span
                  v-if="char === ' '"
                  class="py-0.5 text-[10px] text-base-content/30"
                  >␣</span
                >
                <span v-else class="py-0.5 text-xs">{{ char }}</span>
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
            data-testid="whole-line-edit-btn"
            :title="t('lyrics.wordSplitBar.wholeLineEdit')"
            @click="enterWholeLineEdit"
          >
            <Icon icon="material-symbols:text-fields" class="text-sm" />
          </button>

          <template v-for="(word, wIdx) in words" :key="word.id">
            <div
              v-if="wIdx > 0"
              data-testid="edit-gap"
              class="flex h-5 w-3 cursor-pointer items-center justify-center hover:bg-info/20"
              @click="onGapClickInsert(wIdx)"
            >
              <div class="h-full w-px bg-base-300" />
            </div>

            <input
              v-if="editingWordId === word.id"
              v-model="editingWordText"
              data-testid="word-edit-input"
              class="input input-xs input-bordered w-16"
              @keydown.enter="confirmWordEdit"
              @keydown.escape="cancelWordEdit"
              @blur="confirmWordEdit"
            />

            <div
              v-else
              data-testid="word-edit-block"
              class="group relative cursor-pointer rounded border border-info/30 bg-info/10 px-1.5 py-0.5 text-xs transition-colors hover:bg-info/20"
              @click="onWordClickEdit(word.id, word.text)"
              @contextmenu.prevent="onRemoveWord(word.id)"
            >
              <template v-for="(part, pIdx) in splitBySpaces(word.text)" :key="pIdx"
                ><span v-if="part.isSpace" class="text-[10px] text-base-content/30">{{
                  '␣'.repeat(part.text.length)
                }}</span
                ><template v-else>{{ part.text }}</template></template
              ><template v-if="!word.text">&nbsp;</template>
              <button
                data-testid="word-delete-btn"
                class="pointer-events-none absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-error text-error-content opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
                :title="t('lyrics.wordSplitBar.deleteWord')"
                @click.stop="onRemoveWord(word.id)"
              >
                <Icon icon="material-symbols:close" class="text-[10px]" />
              </button>
            </div>
          </template>
        </template>

        <!-- Whole-line edit mode -->
        <template
          v-else-if="lyricsEditor.splitBarMode.value === 'edit' && wholeLineEditMode"
        >
          <input
            ref="wholeLineInputRef"
            v-model="wholeLineText"
            data-testid="whole-line-input"
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
