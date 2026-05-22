# Lyrics UI/UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 9 UI/UX improvements to the lyrics editor: layout fix, space tracking, word-by-word display, click targets, Enter key bug, Aegisub overlay, and three-state mode switch.

**Architecture:** Changes span 4 layers: core (auto-split + new commands), composable (useLyricsEditor mode/Enter fix), components (LyricsPanel, LyricsLineList, WordSplitBar), and platform (LineOverlayPlugin). Each task is self-contained with tests.

**Tech Stack:** Vue 3 + Pinia, TypeScript, Tailwind CSS + DaisyUI, Canvas 2D API, Vitest + happy-dom + @vue/test-utils

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/core/lyrics/auto-split.ts` | Modify | Preserve trailing spaces in split tokens |
| `src/core/lyrics/auto-split.spec.ts` | Modify | Update expected values, add trailing-space tests |
| `src/core/commands/lyrics-commands.ts` | Modify | Add `createUpdateWordTextCommand`, `createInsertWordCommand`, `createReplaceLineWordsCommand` |
| `src/core/commands/lyrics-commands.spec.ts` | Modify | Tests for new commands |
| `src/composables/useLyricsEditor.ts` | Modify | Fix Enter key on last line; `splitBarMode` → 3-state; auto-switch to timing mode |
| `src/composables/useLyricsEditor.spec.ts` | Modify | Tests for Enter key fix and auto-switch |
| `src/components/shell/AppShell.vue` | Modify | Add `overflow-hidden` to root; update `autoSplitText` caller |
| `src/components/shell/LyricsPanel.vue` | Modify | Swap WordSplitBar/LyricsLineList order; add `min-h-0` |
| `src/components/shell/LyricsLineList.vue` | Modify | Per-word rendering with dividers, ␣, timing colors |
| `src/components/shell/WordSplitBar.vue` | Modify | 3-state switch; widen click targets; ␣ display; edit mode UI |
| `src/platform/waveform/line-overlay-plugin.ts` | Modify | Aegisub-style overlay (boundaries, dashed separators, word text) |
| `src/platform/waveform/line-overlay-plugin.spec.ts` | Modify | Update overlay tests |

---

### Task 1: Auto-split — Preserve Trailing Spaces

**Files:**
- Modify: `src/core/lyrics/auto-split.ts`
- Modify: `src/core/lyrics/auto-split.spec.ts`

- [ ] **Step 1: Update existing test expectations**

The new algorithm preserves trailing spaces in each token (except the last). Update the spec:

```ts
// src/core/lyrics/auto-split.spec.ts
import { describe, expect, it } from 'vitest'

import { autoSplitText } from './auto-split'

describe('autoSplitText', () => {
  it('splits English text by spaces, preserving trailing space', () => {
    expect(autoSplitText('hello world')).toEqual(['hello ', 'world'])
  })

  it('preserves multiple trailing spaces between tokens', () => {
    expect(autoSplitText('hello  world')).toEqual(['hello  ', 'world'])
  })

  it('does not split Chinese text (no spaces)', () => {
    expect(autoSplitText('想起你那笑容')).toEqual(['想起你那笑容'])
  })

  it('does not split Japanese text', () => {
    expect(autoSplitText('きみのこえ')).toEqual(['きみのこえ'])
  })

  it('handles mixed CJK and space-separated words', () => {
    expect(autoSplitText('hello 世界')).toEqual(['hello ', '世界'])
  })

  it('returns single-element array for empty string', () => {
    expect(autoSplitText('')).toEqual([''])
  })

  it('returns single-element array for whitespace-only string', () => {
    expect(autoSplitText('   ')).toEqual([''])
  })

  it('trims leading whitespace but preserves internal trailing spaces', () => {
    expect(autoSplitText(' hello world ')).toEqual(['hello ', 'world'])
  })

  it('last token has no trailing space', () => {
    const result = autoSplitText('a b c')
    expect(result).toEqual(['a ', 'b ', 'c'])
    expect(result[result.length - 1]).toBe('c')
  })

  it('handles tab and mixed whitespace', () => {
    expect(autoSplitText('hello\tworld')).toEqual(['hello\t', 'world'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/core/lyrics/auto-split.spec.ts"`
Expected: FAIL — old implementation returns `['hello', 'world']` not `['hello ', 'world']`

- [ ] **Step 3: Implement new auto-split algorithm**

```ts
// src/core/lyrics/auto-split.ts
export function autoSplitText(text: string): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) return ['']
  if (!trimmed.includes(' ') && !trimmed.includes('\t')) return [trimmed]
  const tokens: string[] = []
  for (const match of trimmed.matchAll(/(\S+)(\s*)/g)) {
    tokens.push(match[1] + match[2])
  }
  if (tokens.length === 0) return ['']
  // Trim trailing whitespace from the last token
  tokens[tokens.length - 1] = tokens[tokens.length - 1].trimEnd()
  return tokens
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/core/lyrics/auto-split.spec.ts"`
Expected: PASS

- [ ] **Step 5: Update autoSplitText caller in AppShell.vue**

In `src/components/shell/AppShell.vue`, the `onPasteLyricsConfirm` function calls `autoSplitText` and creates words. No change needed — `autoSplitText` still returns `string[]`, and `word.text` now includes trailing spaces naturally.

- [ ] **Step 6: Commit**

```bash
git add src/core/lyrics/auto-split.ts src/core/lyrics/auto-split.spec.ts
git commit -m "feat: preserve trailing spaces in autoSplitText tokens"
```

---

### Task 2: Layout Fix — Container Height + WordSplitBar Position

**Files:**
- Modify: `src/components/shell/AppShell.vue:181`
- Modify: `src/components/shell/LyricsPanel.vue`

- [ ] **Step 1: Add overflow-hidden to AppShell root**

In `src/components/shell/AppShell.vue`, line 181, change:

```html
<!-- before -->
<div class="flex h-screen flex-col">
<!-- after -->
<div class="flex h-screen flex-col overflow-hidden">
```

- [ ] **Step 2: Fix LyricsPanel — add min-h-0, swap component order, fix borders**

Replace the entire `src/components/shell/LyricsPanel.vue` template:

```vue
<!-- src/components/shell/LyricsPanel.vue -->
<script setup lang="ts">
import LyricsLineList from './LyricsLineList.vue'
import WordSplitBar from './WordSplitBar.vue'
</script>

<template>
  <section
    data-testid="lyrics-panel"
    class="flex min-h-0 flex-1 flex-col border-t border-base-300"
  >
    <WordSplitBar />
    <div class="min-h-0 flex-1 overflow-hidden">
      <LyricsLineList />
    </div>
  </section>
</template>
```

- [ ] **Step 3: Update WordSplitBar border from border-t to border-b**

In `src/components/shell/WordSplitBar.vue`, line 94, change:

```html
<!-- before -->
class="flex flex-col border-t border-base-300 px-3 py-2"
<!-- after -->
class="flex flex-col border-b border-base-300 px-3 py-2"
```

- [ ] **Step 4: Visual verification**

Run: `pnpm dev`
Verify in browser:
- Scrolling lyrics list does NOT scroll the entire page
- WordSplitBar appears above the lyrics line list
- Spectrogram and menu bar remain fixed

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/AppShell.vue src/components/shell/LyricsPanel.vue src/components/shell/WordSplitBar.vue
git commit -m "fix: prevent page scroll on lyrics overflow and move WordSplitBar above list"
```

---

### Task 3: Enter Key Bug — Last Line Last Word endTime

**Files:**
- Modify: `src/composables/useLyricsEditor.ts:130-151`
- Modify: `src/composables/useLyricsEditor.spec.ts`

- [ ] **Step 1: Write failing test**

Add to the existing `useLyricsEditor.spec.ts` (or create a new describe block):

```ts
describe('handleNextLineKey on last line', () => {
  it('sets last word endTime on the last line', () => {
    // Setup: single line with startTime and 2 words, both untimed
    store.insertLyricLines([
      {
        id: 'line-1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world' },
        ],
      },
    ])
    store.setLineStartTime('line-1', 0)
    store.setWordEndTime('line-1', 'w1', 1.0)

    lyricsEditor.activeLineId.value = 'line-1'
    lyricsEditor.activeWordIndex.value = 2 // past last word

    lyricsEditor.handleNextLineKey(3.0)

    const line = store.project.lyrics[0]
    expect(line.words[1].endTime).toBe(3.0)
  })

  it('does nothing if last line has no startTime', () => {
    store.insertLyricLines([
      {
        id: 'line-1',
        words: [{ id: 'w1', text: 'hello' }],
      },
    ])

    lyricsEditor.activeLineId.value = 'line-1'
    lyricsEditor.handleNextLineKey(3.0)

    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "last line"`
Expected: FAIL — `handleNextLineKey` returns early on last line

- [ ] **Step 3: Fix handleNextLineKey**

In `src/composables/useLyricsEditor.ts`, replace the `handleNextLineKey` function (lines 130–151):

```ts
  function handleNextLineKey(currentTime?: number): void {
    if (!activeLineId.value) return
    const lyrics = store.project.lyrics
    const lineIndex = lyrics.findIndex((l) => l.id === activeLineId.value)
    if (lineIndex === -1) return
    const line = lyrics[lineIndex]

    // Finalize current line's last word (runs for ALL lines including last)
    if (line.startTime !== undefined) {
      const rawTime = currentTime ?? store.currentTime
      const time = _getSnappedTime(rawTime)
      const lastWord = line.words[line.words.length - 1]
      if (lastWord) {
        const prevEnd = _getPrevEndTime(line.words.length - 1)
        const clamped = clampWordTime(time, prevEnd, store.duration)
        store.setWordEndTime(activeLineId.value, lastWord.id, clamped)
      }
    }

    // Advance to next line (skip if last line)
    if (lineIndex >= lyrics.length - 1) return
    const nextLine = lyrics[lineIndex + 1]
    activeLineId.value = nextLine.id
    activeWordIndex.value = 0
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts"`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useLyricsEditor.ts src/composables/useLyricsEditor.spec.ts
git commit -m "fix: set last word endTime when pressing Enter on last line"
```

---

### Task 4: Click Target Widening

**Files:**
- Modify: `src/components/shell/WordSplitBar.vue:140-150,170-176`

- [ ] **Step 1: Widen split-line click target**

In `src/components/shell/WordSplitBar.vue`, replace the split-line div (around line 140–150):

```html
<!-- before -->
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
<!-- after -->
<div
  v-if="wIdx > 0"
  data-testid="split-line"
  class="flex h-5 w-3 cursor-pointer items-center justify-center"
  @click="onSplitLineClick(wIdx)"
>
  <div
    class="h-full w-px transition-colors"
    :class="
      lyricsEditor.splitBarMode.value === 'cut'
        ? 'bg-warning group-hover:bg-error'
        : 'bg-base-300'
    "
  />
</div>
```

- [ ] **Step 2: Widen char-gap click target**

Replace the char-gap div (around line 170–176):

```html
<!-- before -->
<div
  v-if="cIdx > 0"
  data-testid="char-gap"
  class="h-5 w-px cursor-pointer bg-transparent hover:bg-warning"
  @click="onCharGapClick(wIdx, cIdx)"
/>
<!-- after -->
<div
  v-if="cIdx > 0"
  data-testid="char-gap"
  class="flex h-5 w-3 cursor-pointer items-center justify-center hover:bg-warning/20"
  @click="onCharGapClick(wIdx, cIdx)"
>
  <div class="h-full w-px bg-transparent transition-colors" />
</div>
```

- [ ] **Step 3: Visual verification**

Run: `pnpm dev`
Verify: split lines and char gaps are now easy to click (12px hit target with 1px visual line centered).

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/WordSplitBar.vue
git commit -m "fix: widen WordSplitBar split-line and char-gap click targets to 12px"
```

---

### Task 5: LyricsLineList — Word Dividers, Spaces, and Timing Colors

**Files:**
- Modify: `src/components/shell/LyricsLineList.vue`

This task combines spec sections B (display), C (word-by-word), and D (dividers) for LyricsLineList.

- [ ] **Step 1: Add helper functions for word timing state**

In `src/components/shell/LyricsLineList.vue`, replace the `<script setup>` section:

```ts
<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LyricLine, LyricWord } from '../../core/domain/project'
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

function getWordDisplayText(word: LyricWord): string {
  return word.text.trimEnd()
}

function hasTrailingSpace(word: LyricWord): boolean {
  return /\s$/.test(word.text)
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
  if (line.startTime === undefined) return ''
  const total = line.words.length
  const timed = line.words.filter((w) => w.endTime !== undefined).length
  if (timed === total) return `${total}/${total}`
  return `${timed}/${total}`
}
</script>
```

- [ ] **Step 2: Update template for per-word rendering**

Replace the line text span (the `<span class="min-w-0 flex-1 truncate">` area around line 81):

```html
<!-- before -->
<span class="min-w-0 flex-1 truncate">{{ getLineText(line) }}</span>
<!-- after -->
<span class="flex min-w-0 flex-1 items-center truncate">
  <template v-for="(word, wIdx) in line.words" :key="word.id">
    <span
      v-if="wIdx > 0"
      class="mx-px text-base-content/20"
      :class="hasTrailingSpace(line.words[wIdx - 1]) ? 'text-[10px]' : 'text-[8px]'"
    >{{ hasTrailingSpace(line.words[wIdx - 1]) ? '␣' : '|' }}</span>
    <span
      :class="{
        'font-bold': getWordTimingState(line, wIdx) === 'playing',
        'opacity-50': getWordTimingState(line, wIdx) === 'unplayed',
      }"
    >{{ getWordDisplayText(word) }}</span>
  </template>
</span>
```

- [ ] **Step 3: Visual verification**

Run: `pnpm dev`
Verify:
- Words in lyrics list have thin dividers between them
- Space-separated words show ␣ in dim color between them
- Manually-cut words show | as thin divider
- During playback: played words = normal color, playing word = bold, unplayed = dimmer

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/LyricsLineList.vue
git commit -m "feat: word-by-word lyrics display with dividers, space markers, and timing colors"
```

---

### Task 6: Aegisub-Style Line Overlay

**Files:**
- Modify: `src/platform/waveform/line-overlay-plugin.ts`

- [ ] **Step 1: Rewrite _draw() with Aegisub styling**

Replace the `_draw()` method in `src/platform/waveform/line-overlay-plugin.ts`:

```ts
  private _draw(): void {
    if (!this.canvas || !this.wavesurfer) return
    const duration = this.wavesurfer.getDuration()
    if (duration <= 0) return

    const container = this.canvas.parentElement
    if (!container) return
    const w = container.clientWidth
    const h = container.clientHeight
    if (w <= 0 || h <= 0) return

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }

    const visibleDuration = this.visibleEnd - this.visibleStart
    if (visibleDuration <= 0) return

    const pxPerSec = w / visibleDuration
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)

    for (const line of this.params.lyrics) {
      if (line.startTime === undefined) continue
      const lastWord = line.words[line.words.length - 1]
      const lineEnd = lastWord?.endTime
      if (lineEnd === undefined) continue

      const x1 = (line.startTime - this.visibleStart) * pxPerSec
      const x2 = (lineEnd - this.visibleStart) * pxPerSec
      if (x2 < 0 || x1 > w) continue

      const isActive = line.id === this.params.activeLineId
      const clampedX1 = Math.max(0, x1)
      const clampedX2 = Math.min(w, x2)

      // Sentence background fill
      ctx.fillStyle = isActive
        ? 'rgba(100, 180, 255, 0.12)'
        : 'rgba(100, 180, 255, 0.05)'
      ctx.fillRect(clampedX1, 0, clampedX2 - clampedX1, h)

      // Sentence start boundary — red solid line
      if (x1 >= 0 && x1 <= w) {
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(Math.round(x1) + 0.5, 0)
        ctx.lineTo(Math.round(x1) + 0.5, h)
        ctx.stroke()
      }

      // Sentence end boundary — blue solid line
      if (x2 >= 0 && x2 <= w) {
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(Math.round(x2) + 0.5, 0)
        ctx.lineTo(Math.round(x2) + 0.5, h)
        ctx.stroke()
      }

      // Word separator lines (dashed) and word text labels
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
      ctx.shadowBlur = 2
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      let prevWordEnd = line.startTime
      for (let i = 0; i < line.words.length; i++) {
        const word = line.words[i]
        const wordStart = prevWordEnd
        const wordEnd = word.endTime

        // Word separator dashed line (skip first word — that's the sentence start)
        if (i > 0) {
          const sx = Math.round((wordStart - this.visibleStart) * pxPerSec) + 0.5
          if (sx >= 0 && sx <= w) {
            ctx.strokeStyle = isActive
              ? 'rgba(255, 255, 255, 0.5)'
              : 'rgba(255, 255, 255, 0.25)'
            ctx.lineWidth = 1
            ctx.setLineDash([4, 3])
            ctx.beginPath()
            ctx.moveTo(sx, 0)
            ctx.lineTo(sx, h)
            ctx.stroke()
          }
        }

        // Word text label
        if (wordEnd !== undefined) {
          const textX1 = (wordStart - this.visibleStart) * pxPerSec
          const textX2 = (wordEnd - this.visibleStart) * pxPerSec
          const textWidth = textX2 - textX1
          const fontSize = Math.max(10, Math.min(14, textWidth * 0.6))
          ctx.font = `${fontSize}px sans-serif`
          ctx.fillStyle = isActive
            ? 'rgba(255, 255, 255, 0.9)'
            : 'rgba(255, 255, 255, 0.5)'
          const centerX = (textX1 + textX2) / 2
          const displayText = word.text.trimEnd()
          if (textWidth > 8) {
            ctx.fillText(displayText, centerX, h * 0.15, textWidth - 4)
          }
          prevWordEnd = wordEnd
        } else {
          break
        }
      }
      ctx.restore()
    }
  }
```

- [ ] **Step 2: Visual verification**

Run: `pnpm dev`
Load audio and add timed lyrics. Verify on the spectrogram/waveform:
- Red solid line at sentence start
- Blue solid line at sentence end
- White dashed lines between words
- Word text labels in white, centered in each word's time span
- Active line is brighter than inactive lines

- [ ] **Step 3: Commit**

```bash
git add src/platform/waveform/line-overlay-plugin.ts
git commit -m "feat: Aegisub-style line overlay with boundary lines and word text labels"
```

---

### Task 7: Three-State Mode Switch — Type + Composable Changes

**Files:**
- Modify: `src/composables/useLyricsEditor.ts:13,89,130,153`
- Modify: `src/composables/useLyricsEditor.spec.ts`

- [ ] **Step 1: Write failing test for auto-switch**

```ts
describe('auto-switch to timing mode', () => {
  it('switches splitBarMode to timing when handleMarkKey is called', () => {
    // Setup line with words
    store.insertLyricLines([
      {
        id: 'line-1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world' },
        ],
      },
    ])
    lyricsEditor.activeLineId.value = 'line-1'
    lyricsEditor.activeWordIndex.value = 0
    lyricsEditor.splitBarMode.value = 'cut'

    lyricsEditor.handleMarkKey(1.0)

    expect(lyricsEditor.splitBarMode.value).toBe('timing')
  })

  it('switches splitBarMode to timing when handleNextLineKey is called', () => {
    store.insertLyricLines([
      {
        id: 'line-1',
        words: [{ id: 'w1', text: 'hello' }],
        startTime: 0,
      },
      {
        id: 'line-2',
        words: [{ id: 'w2', text: 'world' }],
      },
    ])
    store.setLineStartTime('line-1', 0)
    lyricsEditor.activeLineId.value = 'line-1'
    lyricsEditor.splitBarMode.value = 'edit'

    lyricsEditor.handleNextLineKey(2.0)

    expect(lyricsEditor.splitBarMode.value).toBe('timing')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "auto-switch"`
Expected: FAIL — `splitBarMode` type doesn't include `'timing'` and handlers don't switch mode

- [ ] **Step 3: Update splitBarMode type and add auto-switch**

In `src/composables/useLyricsEditor.ts`:

Change line 13:
```ts
// before
const splitBarMode = ref<'cut' | 'select'>('select')
// after
const splitBarMode = ref<'cut' | 'timing' | 'edit'>('timing')
```

Add `splitBarMode.value = 'timing'` at the start of `handleMarkKey` (after `if (!activeLineId.value) return`):
```ts
  function handleMarkKey(currentTime?: number): void {
    if (!activeLineId.value) return
    splitBarMode.value = 'timing'
    // ... rest unchanged
  }
```

Add `splitBarMode.value = 'timing'` at the start of `handleNextLineKey` (after `if (!activeLineId.value) return`):
```ts
  function handleNextLineKey(currentTime?: number): void {
    if (!activeLineId.value) return
    splitBarMode.value = 'timing'
    // ... rest unchanged
  }
```

Add `splitBarMode.value = 'timing'` at the start of `handleMarkNoAdvanceKey` (after `if (!activeLineId.value) return`):
```ts
  function handleMarkNoAdvanceKey(currentTime?: number): void {
    if (!activeLineId.value) return
    splitBarMode.value = 'timing'
    // ... rest unchanged
  }
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts"`
Expected: PASS (existing tests that reference `'select'` will need updating to `'timing'`)

Note: if existing tests compare `splitBarMode.value === 'select'`, update them to `'timing'`.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useLyricsEditor.ts src/composables/useLyricsEditor.spec.ts
git commit -m "feat: three-state splitBarMode (cut/timing/edit) with auto-switch to timing"
```

---

### Task 8: WordSplitBar — Three-State UI + Space Display

**Files:**
- Modify: `src/components/shell/WordSplitBar.vue`

This is the largest UI change. Replace the mode toggle button with a segmented control, update all `'select'` references to `'timing'`, add ␣ display, and add edit mode UI.

- [ ] **Step 1: Update mode toggle to segmented control**

Replace the single toggle button (lines 98–115) with:

```html
<!-- Three-state segmented control -->
<div class="join" data-testid="split-bar-mode-toggle">
  <button
    class="btn btn-xs join-item"
    :class="lyricsEditor.splitBarMode.value === 'cut' ? 'btn-warning' : 'btn-ghost'"
    :title="t('lyrics.wordSplitBar.cutMode')"
    @click="lyricsEditor.splitBarMode.value = 'cut'"
  >
    <Icon icon="material-symbols:content-cut" class="text-sm" />
  </button>
  <button
    class="btn btn-xs join-item"
    :class="lyricsEditor.splitBarMode.value === 'timing' ? 'btn-primary' : 'btn-ghost'"
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
```

- [ ] **Step 2: Update all 'select' references to 'timing'**

Replace throughout `WordSplitBar.vue`:
- `splitBarMode.value === 'select'` → `splitBarMode.value === 'timing'`
- `splitBarMode.value !== 'select'` → `splitBarMode.value !== 'timing'`
- `lyricsEditor.splitBarMode.value === 'select'` → `lyricsEditor.splitBarMode.value === 'timing'`

Specifically:
- `onWordClick`: guard changes from `!== 'select'` to `!== 'timing'`
- `onStartBlockClick`: guard changes from `!== 'select'` to `!== 'timing'`
- Template `v-if="lyricsEditor.splitBarMode.value === 'select'"` → `=== 'timing'`
- Numeric editor visibility condition: `=== 'select'` → `=== 'timing'`

- [ ] **Step 3: Add ␣ display between word blocks**

Update the split-line template (between word blocks) to show ␣ when the preceding word has trailing space:

```html
<!-- Split line / space indicator between words -->
<div
  v-if="wIdx > 0"
  data-testid="split-line"
  class="flex h-5 w-3 cursor-pointer items-center justify-center"
  @click="onSplitLineClick(wIdx)"
>
  <span
    v-if="words[wIdx - 1]?.text.trimEnd() !== words[wIdx - 1]?.text"
    class="text-[10px] text-base-content/30"
  >␣</span>
  <div
    v-else
    class="h-full w-px transition-colors"
    :class="
      lyricsEditor.splitBarMode.value === 'cut'
        ? 'bg-warning'
        : 'bg-base-300'
    "
  />
</div>
```

- [ ] **Step 4: Add edit mode — inline word editing + whole-line input**

Add reactive state and handler functions in `<script setup>`:

```ts
import { computed, inject, nextTick, ref } from 'vue'

// ... existing imports ...
import { autoSplitText } from '../../core/lyrics/auto-split'

// ... existing code ...

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
  // Preserve original trailing space
  const original = words.value.find((w) => w.id === editingWordId.value)
  const trailingSpace = original ? original.text.slice(original.text.trimEnd().length) : ''
  store.updateWordText(activeLine.value.id, editingWordId.value, newText + trailingSpace)
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
```

- [ ] **Step 5: Add edit mode template section**

Add after the timing-mode word blocks, inside the `v-if="activeLine"` container:

```html
<!-- Edit mode: inline word editing -->
<template v-if="lyricsEditor.splitBarMode.value === 'edit' && !wholeLineEditMode">
  <!-- Whole-line edit button -->
  <button
    class="btn btn-xs btn-ghost"
    :title="t('lyrics.wordSplitBar.wholeLineEdit')"
    @click="enterWholeLineEdit"
  >
    <Icon icon="material-symbols:text-fields" class="text-sm" />
  </button>

  <!-- Start block (non-interactive in edit mode) -->
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

  <!-- Editable word blocks -->
  <template v-for="(word, wIdx) in words" :key="word.id">
    <!-- Gap for inserting new word -->
    <div
      v-if="wIdx > 0"
      data-testid="edit-gap"
      class="flex h-5 w-3 cursor-pointer items-center justify-center hover:bg-info/20"
      @click="onGapClickInsert(wIdx)"
    >
      <span
        v-if="words[wIdx - 1]?.text.trimEnd() !== words[wIdx - 1]?.text"
        class="text-[10px] text-base-content/30"
      >␣</span>
      <div v-else class="h-full w-px bg-base-300" />
    </div>

    <!-- Inline editing input -->
    <input
      v-if="editingWordId === word.id"
      v-model="editingWordText"
      class="input input-xs input-bordered w-16"
      @keydown.enter="confirmWordEdit"
      @keydown.escape="cancelWordEdit"
      @blur="confirmWordEdit"
    />

    <!-- Normal word block (click to edit) -->
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
<template v-if="lyricsEditor.splitBarMode.value === 'edit' && wholeLineEditMode">
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
```

- [ ] **Step 6: Restructure template to gate on mode**

The word blocks area needs to conditionally render based on mode. Wrap existing cut-mode and timing-mode blocks with `v-if`:

The existing `<template v-for="(word, wIdx) in words">` block currently uses `v-if="lyricsEditor.splitBarMode.value === 'timing'"` for the word-block and `v-else` for cut-mode block. Update these to exclude edit mode:

```html
<!-- Timing mode word block -->
<div
  v-if="lyricsEditor.splitBarMode.value === 'timing'"
  ...
/>

<!-- Cut mode word block -->
<div
  v-else-if="lyricsEditor.splitBarMode.value === 'cut'"
  ...
/>
```

The edit mode has its own separate `<template>` block (Step 5 above).

- [ ] **Step 7: Visual verification**

Run: `pnpm dev`
Verify:
- Three-segment mode toggle works (cut/timing/edit)
- Pressing D key auto-switches to timing mode
- Cut mode: 12px click targets, cutting and merging work
- Timing mode: word selection, time editor shown
- Edit mode: click word → inline input, confirm/cancel works
- Edit mode: click gaps → inserts new empty word
- Edit mode: whole-line button → text input with ✓/✗ buttons
- ␣ shown between space-separated words in all modes

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/WordSplitBar.vue
git commit -m "feat: three-state WordSplitBar with cut/timing/edit modes and space display"
```

---

### Task 9: New Store Commands for Edit Mode

**Files:**
- Modify: `src/core/commands/lyrics-commands.ts`
- Create: `src/core/commands/lyrics-commands.spec.ts` (add tests)
- Modify: `src/stores/editor-store.ts`

- [ ] **Step 1: Write failing tests for new commands**

Add to `src/core/commands/lyrics-commands.spec.ts`:

```ts
describe('createUpdateWordTextCommand', () => {
  it('updates word text', () => {
    const state = makeState([
      { id: 'line-1', words: [{ id: 'w1', text: 'hello' }] },
    ])
    const cmd = createUpdateWordTextCommand('line-1', 'w1', 'world')
    const result = cmd.do(state)
    expect(result.lyrics[0].words[0].text).toBe('world')
  })

  it('undoes word text update', () => {
    const state = makeState([
      { id: 'line-1', words: [{ id: 'w1', text: 'hello' }] },
    ])
    const cmd = createUpdateWordTextCommand('line-1', 'w1', 'world')
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words[0].text).toBe('hello')
  })
})

describe('createInsertWordCommand', () => {
  it('inserts a word at the given index', () => {
    const state = makeState([
      {
        id: 'line-1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world' },
        ],
      },
    ])
    const cmd = createInsertWordCommand('line-1', 1, { id: 'w-new', text: 'big' })
    const result = cmd.do(state)
    expect(result.lyrics[0].words.map((w) => w.text)).toEqual(['hello', 'big', 'world'])
  })

  it('undoes word insertion', () => {
    const state = makeState([
      {
        id: 'line-1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world' },
        ],
      },
    ])
    const cmd = createInsertWordCommand('line-1', 1, { id: 'w-new', text: 'big' })
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words.map((w) => w.text)).toEqual(['hello', 'world'])
  })
})

describe('createReplaceLineWordsCommand', () => {
  it('replaces all words and clears timing', () => {
    const state = makeState([
      {
        id: 'line-1',
        words: [
          { id: 'w1', text: 'old', endTime: 1.0 },
        ],
        startTime: 0,
      },
    ])
    const newWords = [
      { id: 'n1', text: 'new ' },
      { id: 'n2', text: 'text' },
    ]
    const cmd = createReplaceLineWordsCommand('line-1', newWords)
    const result = cmd.do(state)
    expect(result.lyrics[0].words).toEqual(newWords)
    expect(result.lyrics[0].startTime).toBeUndefined()
  })

  it('undoes word replacement restoring original words and timing', () => {
    const originalWords = [{ id: 'w1', text: 'old', endTime: 1.0 }]
    const state = makeState([
      { id: 'line-1', words: originalWords, startTime: 0 },
    ])
    const cmd = createReplaceLineWordsCommand('line-1', [{ id: 'n1', text: 'new' }])
    const after = cmd.do(state)
    const restored = cmd.undo(after)
    expect(restored.lyrics[0].words).toEqual(originalWords)
    expect(restored.lyrics[0].startTime).toBe(0)
  })
})
```

(The `makeState` helper creates a `ProjectDocument` with the given lyrics. Use the existing test helper if one exists, or create a minimal one.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts" -t "createUpdateWordTextCommand|createInsertWordCommand|createReplaceLineWordsCommand"`
Expected: FAIL — functions don't exist

- [ ] **Step 3: Implement the three new commands**

Add to `src/core/commands/lyrics-commands.ts`:

```ts
export function createUpdateWordTextCommand(
  lineId: string,
  wordId: string,
  newText: string,
): Command<ProjectDocument> {
  let previousText: string | null = null
  return {
    label: 'lyrics.updateWordText',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const word = line.words.find((w) => w.id === wordId)
      if (!word) return state
      if (previousText === null) previousText = word.text
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, text: newText } : w,
                ),
              }
            : l,
        ),
      }
    },
    undo: (state) => {
      if (previousText === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, text: previousText! } : w,
                ),
              }
            : l,
        ),
      }
    },
  }
}

export function createInsertWordCommand(
  lineId: string,
  insertIndex: number,
  word: { id: string; text: string },
): Command<ProjectDocument> {
  return {
    label: 'lyrics.insertWord',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const newWords = [...line.words]
      newWords.splice(insertIndex, 0, { id: word.id, text: word.text })
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
    undo: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? { ...l, words: l.words.filter((w) => w.id !== word.id) }
            : l,
        ),
      }
    },
  }
}

export function createReplaceLineWordsCommand(
  lineId: string,
  newWords: readonly { id: string; text: string }[],
): Command<ProjectDocument> {
  let previousWords: LyricLine['words'] | null = null
  let previousStartTime: number | undefined | null = null
  return {
    label: 'lyrics.replaceLineWords',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      if (previousWords === null) {
        previousWords = line.words
        previousStartTime = line.startTime
      }
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? { ...l, words: [...newWords], startTime: undefined }
            : l,
        ),
      }
    },
    undo: (state) => {
      if (previousWords === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? { ...l, words: previousWords!, startTime: previousStartTime ?? undefined }
            : l,
        ),
      }
    },
  }
}
```

- [ ] **Step 4: Add store methods that use the new commands**

In `src/stores/editor-store.ts`, add these functions inside the store definition and export them:

```ts
  function updateWordText(lineId: string, wordId: string, newText: string): void {
    execute(createUpdateWordTextCommand(lineId, wordId, newText))
  }

  function insertWord(
    lineId: string,
    insertIndex: number,
    word: { id: string; text: string },
  ): void {
    execute(createInsertWordCommand(lineId, insertIndex, word))
  }

  function replaceLineWords(
    lineId: string,
    newWords: { id: string; text: string }[],
  ): void {
    execute(createReplaceLineWordsCommand(lineId, newWords))
  }
```

Add the imports for the new command factories and add the three functions to the store's return object.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/commands/lyrics-commands.ts src/core/commands/lyrics-commands.spec.ts src/stores/editor-store.ts
git commit -m "feat: add updateWordText, insertWord, and replaceLineWords commands"
```

---

### Task 10: i18n Keys for New UI Labels

**Files:**
- Modify: `src/i18n/locales/zh-CN.json` (or wherever locale messages are)

- [ ] **Step 1: Add i18n keys**

Add the following keys under the `lyrics.wordSplitBar` namespace:

```json
{
  "lyrics": {
    "wordSplitBar": {
      "cutMode": "切词",
      "timingMode": "打轴",
      "editMode": "编辑",
      "wholeLineEdit": "整行编辑"
    }
  }
}
```

(Merge into the existing locale file — do not overwrite existing keys.)

- [ ] **Step 2: Commit**

```bash
git add src/i18n/locales/zh-CN.json
git commit -m "feat: add i18n keys for three-state mode switch labels"
```

---

### Task 11: Lint + Format + Final Verification

- [ ] **Step 1: Run lint and format**

```bash
pnpm lint:fix
pnpm format
```

Fix any issues.

- [ ] **Step 2: Run type check**

```bash
pnpm check
```

Fix any type errors.

- [ ] **Step 3: Run all tests**

```bash
pnpm test:run
```

All tests must pass.

- [ ] **Step 4: Visual smoke test**

Run: `pnpm dev`
Walk through all 9 features in the browser:
1. Page doesn't scroll when lyrics list overflows
2. Pasted English lyrics show trailing-space tokens
3. ␣ shown between space-separated words; thin dividers between cut words
4. During playback: played=normal, playing=bold, unplayed=dim
5. WordSplitBar is above lyrics list
6. Split lines and char gaps are easy to click
7. Press Enter on last line's last word → endTime is set
8. Spectrogram shows Aegisub-style overlay (red start, blue end, dashed separators, word text)
9. Three-state switch works; D key auto-switches to timing; edit mode inline/whole-line editing works

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: lint and format fixes"
```
