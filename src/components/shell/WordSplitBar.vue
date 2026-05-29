<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, inject, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { autoSplitText } from '../../core/lyrics/auto-split'
import { formatTimestamp, parseTimestamp } from '../../core/utils/format-timestamp'
import { createPrefixedId } from '../../platform/ids/create-id'
import { useEditorStore } from '../../stores/editor-store'
import type { LyricsEditorContext } from './injection-keys'
import { LYRICS_EDITOR_KEY } from './injection-keys'

const { t } = useI18n()
const store = useEditorStore()
const lyricsEditor = inject(LYRICS_EDITOR_KEY) as LyricsEditorContext

const activeLine = computed(() => lyricsEditor.activeLine.value)

const words = computed(() => activeLine.value?.words ?? [])
const emptyHintKey = computed(() =>
  store.project.lyrics.length === 0 ? 'lyrics.emptyHint' : 'lyrics.selectLineHint',
)

const selectedWord = computed(() => {
  const index = lyricsEditor.activeWordIndex.value - 1
  if (index < 0) return null
  return words.value[index] ?? null
})

const selectedWordStartTime = computed(() => {
  const index = lyricsEditor.activeWordIndex.value - 1
  if (index < 0 || !selectedWord.value) return undefined
  return getDerivedStartTime(index)
})

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
  const startTime = getDerivedStartTime(index)
  if (startTime !== undefined) store.seekPlayback(startTime)
}

function onStartBlockClick(): void {
  if (lyricsEditor.splitBarMode.value !== 'timing') return
  lyricsEditor.activeWordIndex.value = 0
  if (activeLine.value?.startTime !== undefined) {
    store.seekPlayback(activeLine.value.startTime)
  }
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

function onStartTimeInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const value = parseTimestamp(input.value)
  if (value === null || !activeLine.value) return
  const nextValue = Math.max(0, value)
  if (activeLine.value.startTime === nextValue) return
  store.setLineStartTime(activeLine.value.id, nextValue)
}

function onWordEndTimeInput(wordId: string, event: Event): void {
  const input = event.target as HTMLInputElement
  const value = parseTimestamp(input.value)
  if (value === null || !activeLine.value) return
  const word = words.value.find((w) => w.id === wordId)
  const nextValue = Math.max(0, value)
  if (word?.endTime === nextValue) return
  store.setWordEndTime(activeLine.value.id, wordId, nextValue)
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
    id: createPrefixedId('word'),
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
    id: createPrefixedId('word'),
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

watch(
  () => lyricsEditor.wholeLineEditRequestId.value,
  async () => {
    if (!activeLine.value) return
    lyricsEditor.splitBarMode.value = 'edit'
    await enterWholeLineEdit()
  },
)
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
          :class="lyricsEditor.splitBarMode.value === 'cut' && 'btn-warning'"
          :title="t('lyrics.wordSplitBar.cutMode')"
          @click="lyricsEditor.splitBarMode.value = 'cut'"
        >
          <Icon icon="material-symbols:content-cut" class="text-sm" />
        </button>
        <button
          class="btn btn-xs join-item"
          :class="lyricsEditor.splitBarMode.value === 'timing' && 'btn-primary'"
          :title="t('lyrics.wordSplitBar.timingMode')"
          @click="lyricsEditor.splitBarMode.value = 'timing'"
        >
          <Icon icon="material-symbols:timer-outline" class="text-sm" />
        </button>
        <button
          class="btn btn-xs join-item"
          :class="lyricsEditor.splitBarMode.value === 'edit' && 'btn-info'"
          :title="t('lyrics.wordSplitBar.editMode')"
          @click="lyricsEditor.splitBarMode.value = 'edit'"
        >
          <Icon icon="material-symbols:edit-outline" class="text-sm" />
        </button>
      </div>

      <div v-if="activeLine" class="flex min-w-0 flex-1 items-center gap-2">
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          <!-- Start block (timing mode only) -->
          <div
            v-if="lyricsEditor.splitBarMode.value === 'timing'"
            data-testid="start-block"
            class="flex cursor-pointer items-center rounded border px-1.5 py-0.5 text-xs transition-colors"
            :class="
              isStartBlockActive()
                ? 'bg-error/30 border-error'
                : activeLine.startTime !== undefined
                  ? 'bg-success/30 border-success'
                  : 'bg-base-300/50 border-base-300'
            "
            @click="onStartBlockClick"
          >
            <span>{{ t('lyrics.wordSplitBar.startBlock') }}</span>
          </div>

          <!-- Timing mode: word blocks -->
          <template v-if="lyricsEditor.splitBarMode.value === 'timing'">
            <template v-for="(word, wIdx) in words" :key="word.id">
              <!-- Word block (click to activate) -->
              <div
                data-testid="word-block"
                class="flex cursor-pointer items-center rounded border px-1.5 py-0.5 text-xs transition-colors"
                :class="wordColor(wIdx)"
                @click="onWordClick(wIdx)"
              >
                <span>
                  <template v-for="(part, pIdx) in splitBySpaces(word.text)" :key="pIdx"
                    ><span
                      v-if="part.isSpace"
                      class="text-[10px] text-base-content/30"
                      >{{ '␣'.repeat(part.text.length) }}</span
                    ><template v-else>{{ part.text }}</template></template
                  ><template v-if="!word.text">&nbsp;</template>
                </span>
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
                class="group relative flex h-4 w-1.5 items-center justify-center"
                @click="onSplitLineClick(wIdx)"
              >
                <button
                  data-testid="split-line-hit-target"
                  class="absolute -inset-x-1.5 inset-y-0 cursor-pointer border-0 bg-transparent p-0"
                  type="button"
                  @click.stop="onSplitLineClick(wIdx)"
                />
                <div
                  data-testid="split-line-mark"
                  class="pointer-events-none h-full w-px transition-colors bg-warning"
                />
              </div>

              <div
                data-testid="word-block-cut"
                class="flex items-center rounded border transition-colors px-1.5"
                :class="wordColor(wIdx)"
              >
                <template v-for="(char, cIdx) in word.text.split('')" :key="cIdx">
                  <div
                    v-if="cIdx > 0"
                    data-testid="char-gap"
                    class="group relative flex h-5 w-1.5 items-center justify-center"
                    @click="onCharGapClick(wIdx, cIdx)"
                  >
                    <button
                      data-testid="char-gap-hit-target"
                      class="absolute -inset-x-1 inset-y-0 cursor-pointer border-0 bg-transparent p-0"
                      type="button"
                      @click.stop="onCharGapClick(wIdx, cIdx)"
                    />
                    <div
                      data-testid="char-gap-mark"
                      class="pointer-events-none h-full w-px bg-transparent transition-colors group-hover:bg-warning/70"
                    />
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
              class="btn btn-xs mr-1.5"
              data-testid="whole-line-edit-btn"
              :title="t('lyrics.wordSplitBar.wholeLineEdit')"
              @click="enterWholeLineEdit"
            >
              <Icon icon="radix-icons:input" class="text-sm" />
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

        <div
          v-if="
            lyricsEditor.splitBarMode.value === 'timing' &&
            (isStartBlockActive() || selectedWord)
          "
          data-testid="selected-time-editor"
          class="ml-auto flex shrink-0 items-center gap-1.5 rounded text-[11px] text-base-content/60"
        >
          <template v-if="isStartBlockActive()">
            <span class="whitespace-nowrap">
              {{ t('lyrics.wordSplitBar.startBlock') }}
            </span>
            <input
              data-testid="start-time-input"
              type="text"
              inputmode="decimal"
              class="input input-xs h-5 w-20 border-base-300/70 bg-base-100/70 text-right tabular-nums"
              :value="
                activeLine.startTime !== undefined
                  ? formatTimestamp(activeLine.startTime)
                  : ''
              "
              placeholder="00:00.000"
              @blur="onStartTimeInput"
              @keydown.enter.stop.prevent="onStartTimeInput"
            />
          </template>

          <template v-else-if="selectedWord">
            <span class="whitespace-nowrap tabular-nums">
              {{
                selectedWordStartTime !== undefined
                  ? formatTimestamp(selectedWordStartTime)
                  : '--:--'
              }}
              ~
            </span>
            <input
              data-testid="word-end-time-input"
              type="text"
              inputmode="decimal"
              class="input input-xs h-5 w-20 border-base-300/70 bg-base-100/70 px-1 text-right tabular-nums"
              :value="
                selectedWord.endTime !== undefined
                  ? formatTimestamp(selectedWord.endTime)
                  : ''
              "
              placeholder="00:00.000"
              @blur="onWordEndTimeInput(selectedWord.id, $event)"
              @keydown.enter.stop.prevent="onWordEndTimeInput(selectedWord.id, $event)"
            />
          </template>
        </div>
      </div>

      <div v-else class="flex-1 text-xs opacity-40">
        {{ t(emptyHintKey) }}
      </div>
    </div>
  </div>
</template>
