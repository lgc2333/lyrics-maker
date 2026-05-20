# Phase 4 歌词打轴 — Part 3: UI Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI layer for lyrics timing: LyricsPanel (LyricsLineList + WordSplitBar), MenuBar lyrics menu, LineOverlay canvas plugin, and i18n keys. After this part, the full lyrics timing workflow is usable end-to-end.

**Architecture:** LyricsPanel replaces the pre-Phase-3 scaffold, split into LyricsLineList (scrollable row list with three-state highlighting) and WordSplitBar (cut/select modes, three-color word blocks). LineOverlay is a Canvas-based WaveSurfer plugin modeled after GridOverlayPlugin. All state flows through `useLyricsEditor` composable (injected via LYRICS_EDITOR_KEY from Part 2).

**Tech Stack:** Vue 3 SFC, Tailwind CSS / DaisyUI, WaveSurfer.js BasePlugin, `@iconify/vue`, Vitest + `@vue/test-utils`

**Spec:** `docs/superpowers/specs/2026-05-20-phase-4-lyrics-timing-design.md` — sections 3, 8, 9, 10, 11

**Depends on:** Part 1 (data model, commands) + Part 2 (store actions, useLyricsEditor, shortcuts) complete

---

## File Structure

### New Files
- `src/components/shell/LyricsLineList.vue` — scrollable line list with select/active states
- `src/components/shell/WordSplitBar.vue` — cut/select mode word blocks panel
- `src/components/shell/LyricsPasteModal.vue` — textarea modal for pasting lyrics
- `src/platform/waveform/line-overlay-plugin.ts` — Canvas overlay for sentence/word regions

### Modified Files
- `src/components/shell/LyricsPanel.vue` — replace scaffold with real LyricsLineList + WordSplitBar
- `src/components/shell/MenuBar.vue` — add "歌词" menu with paste/import/add-line
- `src/i18n/locales/zh-CN.json` — add all Phase 4 i18n keys
- `src/composables/useTimelineView.ts` — integrate LineOverlay plugin in lyrics mode

---

## Task 1: i18n Keys

**Files:**
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Add Phase 4 lyrics i18n keys**

In `src/i18n/locales/zh-CN.json`, replace the existing `"lyrics"` block and add menu keys:

```json
"lyrics": {
  "title": "歌词编辑器",
  "emptyHint": "从上方「歌词」菜单导入或粘贴歌词以开始打轴",
  "timingControl": "打轴控制",
  "lineList": {
    "title": "歌词行",
    "noStartTime": "--:--"
  },
  "wordSplitBar": {
    "title": "词块",
    "modeCut": "剪刀",
    "modeSelect": "选中",
    "startBlock": "起始",
    "endTimeLabel": "结束时间",
    "derivedStartLabel": "起始时间"
  }
}
```

Add to `"shell"."menu"`:
```json
"lyrics": "歌词",
"pasteLyrics": "粘贴歌词...",
"importLyricsFile": "导入歌词文件...",
"addLyricLine": "添加空行"
```

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/i18n/locales/zh-CN.json
git commit -m "feat: add Phase 4 lyrics i18n keys

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: LyricsLineList Component

**Files:**
- Create: `src/components/shell/LyricsLineList.vue`

- [ ] **Step 1: Implement LyricsLineList**

Create `src/components/shell/LyricsLineList.vue`:

```vue
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

function getWordStatus(line: { words: { endTime?: number }[]; startTime?: number }): string {
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
          {{ line.startTime !== undefined ? formatTimestamp(line.startTime) : t('lyrics.lineList.noStartTime') }}
        </span>
        <span class="min-w-0 flex-1 truncate">{{ getLineText(line) }}</span>
        <span class="w-10 text-right text-xs opacity-40">{{ getWordStatus(line) }}</span>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/components/shell/LyricsLineList.vue
git commit -m "feat: add LyricsLineList component with select/active states

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: WordSplitBar Component

**Files:**
- Create: `src/components/shell/WordSplitBar.vue`

- [ ] **Step 1: Implement WordSplitBar**

Create `src/components/shell/WordSplitBar.vue`:

```vue
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

  // Midpoint interpolation (spec §8): if the split word had an endTime,
  // the back word inherits it, and the front word needs a computed endTime.
  // Compute midpoint between prev endTime (or line startTime) and the original endTime.
  if (word.endTime !== undefined) {
    const prevEnd = wordIndex === 0
      ? activeLine.value?.startTime
      : words.value[wordIndex - 1]?.endTime
    if (prevEnd !== undefined) {
      const midpoint = (prevEnd + word.endTime) / 2
      // Re-read the words array after split to get the new front word
      const updatedLine = store.project.lyrics.find((l) => l.id === activeLine.value!.id)
      if (updatedLine) {
        const frontWord = updatedLine.words[wordIndex]
        if (frontWord && frontWord.endTime === undefined) {
          // snapToGrid would be ideal here but requires timing points access;
          // store.setWordEndTime is sufficient — user can fine-tune later
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
  const value = parseFloat(input.value)
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
        @click="lyricsEditor.splitBarMode.value = lyricsEditor.splitBarMode.value === 'cut' ? 'select' : 'cut'"
      >
        <Icon
          :icon="lyricsEditor.splitBarMode.value === 'cut'
            ? 'material-symbols:content-cut'
            : 'material-symbols:touch-app-rounded'"
          class="text-sm"
        />
      </button>

      <div v-if="activeLine" class="flex flex-1 flex-wrap items-center gap-0.5 overflow-auto">
        <!-- Start block -->
        <div
          data-testid="start-block"
          class="cursor-pointer rounded px-1.5 py-0.5 text-xs border transition-colors"
          :class="isStartBlockActive()
            ? 'bg-error/30 border-error'
            : (activeLine.startTime !== undefined ? 'bg-success/30 border-success' : 'bg-base-300/50 border-base-300')"
          @click="onStartBlockClick"
        >
          {{ t('lyrics.wordSplitBar.startBlock') }}
        </div>

        <!-- Word blocks -->
        <template v-for="(word, wIdx) in words" :key="word.id">
          <!-- Split line between words (clickable to merge in cut mode) -->
          <div
            v-if="wIdx > 0"
            class="h-5 w-px cursor-pointer transition-colors"
            :class="lyricsEditor.splitBarMode.value === 'cut' ? 'bg-warning hover:bg-error' : 'bg-base-300'"
            @click="onSplitLineClick(wIdx)"
          />

          <!-- Word block (in select mode: click to activate; in cut mode: show characters) -->
          <div
            v-if="lyricsEditor.splitBarMode.value === 'select'"
            class="cursor-pointer rounded px-1.5 py-0.5 text-xs border transition-colors"
            :class="wordColor(wIdx)"
            @click="onWordClick(wIdx)"
          >
            {{ word.text || '&nbsp;' }}
          </div>

          <!-- Cut mode: individual characters with gap hotspots -->
          <div
            v-else
            class="flex items-center rounded border transition-colors"
            :class="wordColor(wIdx)"
          >
            <template v-for="(char, cIdx) in word.text.split('')" :key="cIdx">
              <div
                v-if="cIdx > 0"
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
      v-if="lyricsEditor.splitBarMode.value === 'select' && activeLine && lyricsEditor.activeWordIndex.value > 0 && lyricsEditor.activeWordIndex.value <= words.length"
      class="mt-1.5 flex items-center gap-3 text-xs"
    >
      <span class="opacity-50">{{ t('lyrics.wordSplitBar.derivedStartLabel') }}:</span>
      <span class="tabular-nums">
        {{ getDerivedStartTime(lyricsEditor.activeWordIndex.value - 1) !== undefined
          ? formatTimestamp(getDerivedStartTime(lyricsEditor.activeWordIndex.value - 1)!)
          : '--:--' }}
      </span>
      <span class="opacity-50">{{ t('lyrics.wordSplitBar.endTimeLabel') }}:</span>
      <input
        type="number"
        step="0.001"
        class="input input-xs input-bordered w-24 tabular-nums"
        :value="words[lyricsEditor.activeWordIndex.value - 1]?.endTime ?? ''"
        :placeholder="'--:--'"
        @change="onEndTimeInput($event)"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/components/shell/WordSplitBar.vue
git commit -m "feat: add WordSplitBar with cut/select modes and three-color blocks

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: LyricsPanel — Wire Components

**Files:**
- Modify: `src/components/shell/LyricsPanel.vue`

- [ ] **Step 1: Replace scaffold with real components**

Replace the entire content of `src/components/shell/LyricsPanel.vue`:

```vue
<script setup lang="ts">
import LyricsLineList from './LyricsLineList.vue'
import WordSplitBar from './WordSplitBar.vue'
</script>

<template>
  <section data-testid="lyrics-panel" class="flex flex-1 flex-col border-t border-base-300">
    <div class="min-h-0 flex-1 overflow-hidden">
      <LyricsLineList />
    </div>
    <WordSplitBar />
  </section>
</template>
```

- [ ] **Step 2: Run type check + tests**

Run: `pnpm check && pnpm test:run`
Expected: All pass.

- [ ] **Step 3: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/components/shell/LyricsPanel.vue
git commit -m "feat: replace LyricsPanel scaffold with LyricsLineList + WordSplitBar

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: LyricsPasteModal + MenuBar Lyrics Menu

**Files:**
- Create: `src/components/shell/LyricsPasteModal.vue`
- Modify: `src/components/shell/MenuBar.vue`
- Modify: `src/components/shell/AppShell.vue`

- [ ] **Step 1: Create LyricsPasteModal**

Create `src/components/shell/LyricsPasteModal.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  confirm: [text: string]
  cancel: []
}>()

const textContent = ref('')

function onConfirm(): void {
  emit('confirm', textContent.value)
  textContent.value = ''
}

function onCancel(): void {
  emit('cancel')
  textContent.value = ''
}
</script>

<template>
  <dialog data-testid="lyrics-paste-modal" class="modal modal-open">
    <div class="modal-box w-full max-w-lg">
      <h3 class="text-lg font-bold">粘贴歌词</h3>
      <textarea
        v-model="textContent"
        data-testid="lyrics-paste-textarea"
        class="textarea textarea-bordered mt-3 h-48 w-full font-mono text-sm"
        placeholder="每行一句歌词..."
        autofocus
      />
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm" @click="onCancel">取消</button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="textContent.trim().length === 0"
          @click="onConfirm"
        >
          确定
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="onCancel">
      <button>close</button>
    </form>
  </dialog>
</template>
```

- [ ] **Step 2: Add lyrics menu to MenuBar**

In `src/components/shell/MenuBar.vue`, add a new menu dropdown after the "help" menu in the `<nav>` section. Add `audioLoaded` prop (already added in Part 2 Task 8). Add emit for lyrics actions:

Update emits:
```ts
const emit = defineEmits<{
  switchMode: [mode: 'timing' | 'lyrics']
  toggleTheme: []
  openAudioFile: []
  pasteLyrics: []
  importLyricsFile: []
  addLyricLine: []
}>()
```

Update MenuName type:
```ts
type MenuName = 'file' | 'edit' | 'view' | 'help' | 'lyrics'
```

Add lyrics menu dropdown in template (after the help menu `<div>`):

```html
<div class="relative">
  <button
    data-testid="menu-trigger-lyrics"
    aria-haspopup="true"
    :aria-expanded="openMenu === 'lyrics'"
    class="rounded px-1.5 py-0.5 hover:bg-base-300"
    @click="toggleMenu('lyrics')"
  >
    {{ t('shell.menu.lyrics') }}
  </button>
  <div
    v-if="openMenu === 'lyrics'"
    data-testid="menu-popup-lyrics"
    role="menu"
    class="absolute left-0 top-full z-50 mt-0.5 min-w-[140px] rounded border border-base-300 bg-base-100 shadow"
  >
    <button
      data-testid="menu-paste-lyrics"
      role="menuitem"
      class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
      @click="emit('pasteLyrics'); openMenu = null"
    >
      {{ t('shell.menu.pasteLyrics') }}
    </button>
    <button
      role="menuitem"
      class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
      @click="emit('importLyricsFile'); openMenu = null"
    >
      {{ t('shell.menu.importLyricsFile') }}
    </button>
    <div class="my-0.5 border-t border-base-300" />
    <button
      role="menuitem"
      class="block w-full cursor-pointer px-2 py-1 text-left text-[11px] hover:bg-base-200"
      @click="emit('addLyricLine'); openMenu = null"
    >
      {{ t('shell.menu.addLyricLine') }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Wire MenuBar lyrics events in AppShell**

In `src/components/shell/AppShell.vue`, add state and handlers:

```ts
import LyricsPasteModal from './LyricsPasteModal.vue'
import { autoSplitText } from '../../core/lyrics/auto-split'
import type { LyricLine, LyricWord } from '../../core/domain/project'

const showPasteModal = ref(false)

function onPasteLyricsConfirm(text: string): void {
  showPasteModal.value = false
  const rawLines = text.split('\n').filter((l) => l.trim().length > 0)
  const lines: LyricLine[] = rawLines.map((rawText) => {
    const tokens = autoSplitText(rawText.trim())
    const words: LyricWord[] = tokens.map((t) => ({
      id: crypto.randomUUID(),
      text: t,
    }))
    return { id: crypto.randomUUID(), words }
  })
  if (lines.length > 0) store.insertLyricLines(lines)
}

function onAddLyricLine(): void {
  store.insertLyricLines([
    { id: crypto.randomUUID(), words: [{ id: crypto.randomUUID(), text: '' }] },
  ])
}
```

In template, add modal and wire events:
```html
<MenuBar
  :mode="editorMode"
  :theme="theme"
  :audio-loaded="!!store.audioFile"
  @switchMode="(mode) => { if (mode === 'lyrics' && !store.audioFile) return; editorMode = mode }"
  @toggleTheme="toggleTheme"
  @openAudioFile="openAudioPicker"
  @pasteLyrics="showPasteModal = true"
  @importLyricsFile="() => { /* Phase 5: file import */ }"
  @addLyricLine="onAddLyricLine"
/>
<LyricsPasteModal
  v-if="showPasteModal"
  @confirm="onPasteLyricsConfirm"
  @cancel="showPasteModal = false"
/>
```

- [ ] **Step 4: Run type check + tests**

Run: `pnpm check && pnpm test:run`
Expected: All pass.

- [ ] **Step 5: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/components/shell/LyricsPasteModal.vue src/components/shell/MenuBar.vue src/components/shell/AppShell.vue
git commit -m "feat: add lyrics paste modal and MenuBar lyrics menu

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: LineOverlay Canvas Plugin

**Files:**
- Create: `src/platform/waveform/line-overlay-plugin.ts`
- Modify: `src/composables/useTimelineView.ts`

- [ ] **Step 1: Implement LineOverlayPlugin**

Create `src/platform/waveform/line-overlay-plugin.ts`:

```ts
import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

import type { LyricLine } from '../../core/domain/project'

export interface LineOverlayOptions {
  outerContainer?: HTMLElement
}

export interface LineOverlayParams {
  lyrics: LyricLine[]
  activeLineId: string | null
  currentTime: number
}

export class LineOverlayPlugin extends BasePlugin<
  BasePluginEvents,
  LineOverlayOptions
> {
  private canvas: HTMLCanvasElement | null = null
  private params: LineOverlayParams = {
    lyrics: [],
    activeLineId: null,
    currentTime: 0,
  }
  private visibleStart = 0
  private visibleEnd = 0

  static create(options?: LineOverlayOptions): LineOverlayPlugin {
    return new LineOverlayPlugin(options ?? {})
  }

  protected onInit(): void {
    const ws = this.wavesurfer!
    const wrapper = ws.getWrapper()
    const scrollContainer = wrapper.parentElement

    const containerEl: HTMLElement =
      this.options.outerContainer ??
      (() => {
        const root = wrapper.getRootNode()
        const host = (root as ShadowRoot).host
        return (host as HTMLElement | undefined) ?? wrapper
      })()

    this.canvas = document.createElement('canvas')
    Object.assign(this.canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '3',
    })
    containerEl.style.position = 'relative'
    containerEl.appendChild(this.canvas)

    this.subscriptions.push(
      ws.on('scroll', (start: number, end: number) => {
        this.visibleStart = start
        this.visibleEnd = end
        this._draw()
      }),
      ws.on('redraw', () => this._draw()),
      ws.on('zoom', () => {
        if (scrollContainer) {
          const duration = ws.getDuration()
          if (wrapper.scrollWidth > 0 && duration > 0) {
            const pxPerSec = wrapper.scrollWidth / duration
            this.visibleStart = scrollContainer.scrollLeft / pxPerSec
            this.visibleEnd =
              (scrollContainer.scrollLeft + scrollContainer.clientWidth) / pxPerSec
          }
        }
        this._draw()
      }),
      ws.on('ready', () => {
        if (scrollContainer) {
          const duration = ws.getDuration()
          if (wrapper.scrollWidth > 0 && duration > 0) {
            const pxPerSec = wrapper.scrollWidth / duration
            this.visibleStart = scrollContainer.scrollLeft / pxPerSec
            this.visibleEnd =
              (scrollContainer.scrollLeft + scrollContainer.clientWidth) / pxPerSec
          }
        }
        this._draw()
      }),
    )
  }

  update(params: LineOverlayParams): void {
    this.params = params
    this._draw()
  }

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

      // Sentence block
      const isActive = line.id === this.params.activeLineId
      ctx.fillStyle = isActive
        ? 'rgba(100, 180, 255, 0.15)'
        : 'rgba(100, 180, 255, 0.07)'
      ctx.fillRect(Math.max(0, x1), 0, Math.min(w, x2) - Math.max(0, x1), h)

      // Word separator lines
      for (const word of line.words) {
        if (word.endTime === undefined) continue
        const wx = Math.round((word.endTime - this.visibleStart) * pxPerSec) + 0.5
        if (wx < 0 || wx > w) continue
        ctx.strokeStyle = isActive
          ? 'rgba(100, 180, 255, 0.6)'
          : 'rgba(100, 180, 255, 0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(wx, 0)
        ctx.lineTo(wx, h)
        ctx.stroke()
      }
    }
  }

  destroy(): void {
    this.canvas?.remove()
    this.canvas = null
    super.destroy()
  }
}
```

- [ ] **Step 2: Integrate in useTimelineView**

In `src/composables/useTimelineView.ts`, add LineOverlay plugin integration.

Add import:
```ts
import { LineOverlayPlugin } from '../platform/waveform/line-overlay-plugin'
```

Add plugin variable alongside `gridPlugin`:
```ts
let lineOverlayPlugin: LineOverlayPlugin | null = null
```

In `_initWaveSurfer`, after registering gridPlugin:
```ts
lineOverlayPlugin = view.registerPlugin(
  LineOverlayPlugin.create({ outerContainer: container }),
)
```

Add a helper to build overlay params:
```ts
function _buildLineOverlayParams() {
  return {
    lyrics: store.project.lyrics,
    activeLineId: null as string | null, // will be wired to lyricsEditor in AppShell
    currentTime: store.currentTime,
  }
}
```

In the `watch(() => store.currentTime, ...)`, add after `gridPlugin?.update(...)`:
```ts
lineOverlayPlugin?.update(_buildLineOverlayParams())
```

In the `watch([...timingPoints...], ...)` watcher, add:
```ts
lineOverlayPlugin?.update(_buildLineOverlayParams())
```

Add new watcher for lyrics data:
```ts
watch(
  () => store.project.lyrics,
  () => {
    lineOverlayPlugin?.update(_buildLineOverlayParams())
  },
  { deep: true },
)
```

In `onUnmounted`, add:
```ts
lineOverlayPlugin = null
```

In `setViewMode`, add:
```ts
lineOverlayPlugin = null
```

- [ ] **Step 3: Run type check + tests**

Run: `pnpm check && pnpm test:run`
Expected: All pass.

- [ ] **Step 4: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/platform/waveform/line-overlay-plugin.ts src/composables/useTimelineView.ts
git commit -m "feat: add LineOverlay canvas plugin for lyrics sentence/word visualization

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Final Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test:run`
Expected: All tests pass.

- [ ] **Step 2: Run type check + lint + build**

Run: `pnpm check && pnpm lint && pnpm build`
Expected: All clean.

- [ ] **Step 3: Manual browser verification**

Run: `pnpm dev`

Verify in browser:
1. Without audio loaded: lyrics mode button is disabled
2. Import audio → switch to lyrics mode → see empty state hint
3. Menu → 歌词 → 粘贴歌词 → paste multi-line text → confirm → lines appear in LyricsLineList
4. English text auto-splits by spaces; Chinese text stays as one word per line
5. Click a line → it highlights (selected state)
6. WordSplitBar shows word blocks with start block
7. Toggle cut/select mode in WordSplitBar
8. In cut mode: click between characters to split, click split line to merge
9. In select mode: click word blocks to set active word
10. Press D → line gets startTime, activeWordIndex advances
11. Continue pressing D → words get endTime, blocks turn green
12. Press Enter → moves to next line
13. Ctrl+Z → undo, activeWordIndex resets correctly
14. Waveform shows LineOverlay colored regions for timed lines

---

## Verification

After completing all tasks:

1. `pnpm test:run` — all green
2. `pnpm check` — no type errors
3. `pnpm build` — succeeds
4. `pnpm lint` — clean
5. LyricsLineList renders with select/active/selected+active states
6. WordSplitBar supports cut mode (character-level split/merge) and select mode (word activation)
7. Three-color word blocks: green (timed), red (current target), black (pending)
8. Paste modal parses multi-line text with auto-split
9. MenuBar lyrics menu works (paste, add line)
10. LineOverlay renders sentence blocks and word separator lines on waveform
11. Full D/Enter/Shift+D workflow works end-to-end in browser
12. Lyrics mode disabled without audio
