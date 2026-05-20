# Phase 4 歌词打轴 — Part 2: Store Actions & Lyrics Editor Composable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement editor-store lyrics actions and the `useLyricsEditor` composable that drives the D/Enter/Shift+D state machine, undo/redo sync, and snap-to-grid integration.

**Architecture:** New store actions delegate to lyrics-commands from Part 1. `useLyricsEditor` is a Vue composable holding session state (activeLineId, activeWordIndex, splitBarMode) and keyboard handler logic. It uses `provide/inject` like the existing `useTimelineView` pattern. The composable is tested via a harness component pattern (see CLAUDE.md "Composable Testing").

**Tech Stack:** TypeScript, Vitest, Vue 3 composables, Pinia store, `@vue/test-utils`

**Spec:** `docs/superpowers/specs/2026-05-20-phase-4-lyrics-timing-design.md` — sections 4, 5, 6, 7 (store actions), 12, 13

**Depends on:** Part 1 complete (data model, lyrics-commands, snapToNearestGridPoint, shortcut registry)

---

## File Structure

### New Files
- `src/composables/useLyricsEditor.ts` — lyrics editor session state + D/Enter/Shift+D state machine
- `src/composables/useLyricsEditor.spec.ts` — tests for composable state machine logic
- `src/core/lyrics/auto-split.ts` — auto-split utility (space-delimited languages)
- `src/core/lyrics/auto-split.spec.ts` — tests for auto-split

### Modified Files
- `src/stores/editor-store.ts` — add 7 new lyrics actions, wire to lyrics-commands
- `src/stores/editor-store.spec.ts` — add tests for new store actions
- `src/composables/useEditorShortcuts.ts` — register lyrics-mode shortcut bindings
- `src/components/shell/AppShell.vue` — wire lyrics shortcuts + useLyricsEditor provide
- `src/components/shell/injection-keys.ts` — add LYRICS_EDITOR_KEY

---

## Task 1: Auto-Split Utility

**Files:**
- Create: `src/core/lyrics/auto-split.ts`
- Create: `src/core/lyrics/auto-split.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/core/lyrics/auto-split.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { autoSplitText } from './auto-split'

describe('autoSplitText', () => {
  it('splits English text by spaces', () => {
    expect(autoSplitText('hello world')).toEqual(['hello', 'world'])
  })

  it('splits text with multiple spaces into tokens (no empty strings)', () => {
    expect(autoSplitText('hello  world')).toEqual(['hello', 'world'])
  })

  it('does not split Chinese text (no spaces)', () => {
    expect(autoSplitText('想起你那笑容')).toEqual(['想起你那笑容'])
  })

  it('does not split Japanese text', () => {
    expect(autoSplitText('きみのこえ')).toEqual(['きみのこえ'])
  })

  it('handles mixed CJK and space-separated words', () => {
    // If any spaces exist, split by spaces — user gets control in cut mode
    expect(autoSplitText('hello 世界')).toEqual(['hello', '世界'])
  })

  it('returns single-element array for empty string', () => {
    expect(autoSplitText('')).toEqual([''])
  })

  it('returns single-element array for whitespace-only string', () => {
    expect(autoSplitText('   ')).toEqual([''])
  })

  it('preserves leading/trailing content when splitting', () => {
    expect(autoSplitText(' hello world ')).toEqual(['hello', 'world'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/core/lyrics/auto-split.spec.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement autoSplitText**

Create `src/core/lyrics/auto-split.ts`:

```ts
/**
 * Splits a lyrics line text into word tokens for auto-split.
 * Languages that use spaces (English, etc.): split by whitespace.
 * Languages without spaces (Chinese, Japanese, etc.): return as single token.
 * Always returns at least one element (empty string for blank input).
 */
export function autoSplitText(text: string): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) return ['']
  if (!trimmed.includes(' ')) return [trimmed]
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0)
  return tokens.length === 0 ? [''] : tokens
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/core/lyrics/auto-split.spec.ts"`
Expected: All PASS.

- [ ] **Step 5: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/core/lyrics/auto-split.ts src/core/lyrics/auto-split.spec.ts
git commit -m "feat: add autoSplitText utility for lyrics import

Splits by whitespace for space-delimited languages, keeps CJK text intact.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Editor Store — Lyrics Actions

**Files:**
- Modify: `src/stores/editor-store.ts`
- Modify: `src/stores/editor-store.spec.ts`

- [ ] **Step 1: Write failing tests for store lyrics actions**

Add to `src/stores/editor-store.spec.ts` a new describe block:

```ts
describe('lyrics actions', () => {
  let store: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    const { transport } = createMockAudioTransport()
    const { scheduler } = createMockMetronome()
    __overrideAudioTransportFactory(() => transport)
    __overrideMetronomeFactory(() => scheduler)
    setActivePinia(createPinia())
    store = useEditorStore()
  })

  it('insertLyricLines appends lines and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    expect(store.project.lyrics).toHaveLength(2)
    expect(store.project.lyrics[0].id).toBe('l1')
    store.undo()
    expect(store.project.lyrics).toHaveLength(0)
  })

  it('removeLyricLine removes a line and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
    ])
    store.removeLyricLine('l1')
    expect(store.project.lyrics).toHaveLength(0)
    store.undo()
    expect(store.project.lyrics).toHaveLength(1)
  })

  it('setLineStartTime sets startTime and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
    ])
    store.setLineStartTime('l1', 1.5)
    expect(store.project.lyrics[0].startTime).toBe(1.5)
    store.undo()
    expect(store.project.lyrics[0].startTime).toBeUndefined()
  })

  it('setWordEndTime sets endTime and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    store.setWordEndTime('l1', 'w1', 2.0)
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
    store.undo()
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })

  it('clearWordEndTime clears endTime and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello', endTime: 2.0 }], startTime: 0 },
    ])
    store.clearWordEndTime('l1', 'w1')
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
    store.undo()
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
  })

  it('splitWord splits a word and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
    ])
    store.splitWord('l1', 'w1', 2)
    expect(store.project.lyrics[0].words).toHaveLength(2)
    expect(store.project.lyrics[0].words[0].text).toBe('he')
    expect(store.project.lyrics[0].words[1].text).toBe('llo')
    store.undo()
    expect(store.project.lyrics[0].words).toHaveLength(1)
    expect(store.project.lyrics[0].words[0].text).toBe('hello')
  })

  it('mergeWords merges adjacent words and is undoable', () => {
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'hel', endTime: 1.0 },
          { id: 'w2', text: 'lo', endTime: 2.0 },
        ],
      },
    ])
    store.mergeWords('l1', 'w1')
    expect(store.project.lyrics[0].words).toHaveLength(1)
    expect(store.project.lyrics[0].words[0].text).toBe('hello')
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
    store.undo()
    expect(store.project.lyrics[0].words).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/stores/editor-store.spec.ts" -t "lyrics actions"`
Expected: FAIL — `store.insertLyricLines` is not a function.

- [ ] **Step 3: Implement store lyrics actions**

In `src/stores/editor-store.ts`, add imports and actions:

Add to imports:
```ts
import {
  createClearWordEndTimeCommand,
  createInsertLyricLinesCommand,
  createMergeWordsCommand,
  createRemoveLyricLineCommand,
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createSplitWordCommand,
} from '../core/commands/lyrics-commands'
import type { LyricLine } from '../core/domain/project'
```

Add actions before the `return` block:
```ts
// ---- Phase 4: Lyrics ----

function insertLyricLines(lines: LyricLine[]): void {
  execute(createInsertLyricLinesCommand(lines))
}

function removeLyricLine(lineId: string): void {
  execute(createRemoveLyricLineCommand(lineId))
}

function setLineStartTime(lineId: string, time: number): void {
  execute(createSetLineStartTimeCommand(lineId, time))
}

function setWordEndTime(lineId: string, wordId: string, time: number): void {
  execute(createSetWordEndTimeCommand(lineId, wordId, time))
}

function clearWordEndTime(lineId: string, wordId: string): void {
  execute(createClearWordEndTimeCommand(lineId, wordId))
}

function splitWord(lineId: string, wordId: string, charIndex: number): void {
  execute(createSplitWordCommand(lineId, wordId, charIndex, crypto.randomUUID()))
}

function mergeWords(lineId: string, wordId: string): void {
  execute(createMergeWordsCommand(lineId, wordId))
}
```

Add to the return object:
```ts
// Phase 4: lyrics
insertLyricLines,
removeLyricLine,
setLineStartTime,
setWordEndTime,
clearWordEndTime,
splitWord,
mergeWords,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/stores/editor-store.spec.ts" -t "lyrics actions"`
Expected: All PASS.

- [ ] **Step 5: Run full store tests**

Run: `pnpm test:run "src/stores/editor-store.spec.ts"`
Expected: All PASS (no regressions).

- [ ] **Step 6: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/stores/editor-store.ts src/stores/editor-store.spec.ts
git commit -m "feat: add lyrics store actions (insert, remove, split, merge, timing)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Injection Key + useLyricsEditor Skeleton

**Files:**
- Modify: `src/components/shell/injection-keys.ts`
- Create: `src/composables/useLyricsEditor.ts`
- Create: `src/composables/useLyricsEditor.spec.ts`

- [ ] **Step 1: Add injection key**

In `src/components/shell/injection-keys.ts`:

```ts
import type { InjectionKey, Ref, ShallowRef } from 'vue'

export const MAIN_VIEW_HEIGHT_KEY: InjectionKey<Ref<number>> = Symbol('mainViewHeight')

export const TIMELINE_CONTAINER_REF_KEY: InjectionKey<ShallowRef<HTMLElement | null>> =
  Symbol('timelineContainerRef')

// Phase 4: lyrics editor composable context
export type LyricsEditorContext = import('../../composables/useLyricsEditor').LyricsEditorContext
export const LYRICS_EDITOR_KEY: InjectionKey<LyricsEditorContext> =
  Symbol('lyricsEditor')
```

- [ ] **Step 2: Write failing tests for composable skeleton**

Create `src/composables/useLyricsEditor.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import type { AudioTransport } from '../platform/audio/audio-transport'
import type { MetronomeScheduler } from '../platform/audio/metronome'
import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from '../stores/editor-store'
import { useLyricsEditor } from './useLyricsEditor'

function createMockAudioTransport(): AudioTransport {
  let _playing = false
  let _currentTime = 0
  return {
    loadFile: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(async () => { _playing = true }),
    pause: vi.fn(() => { _playing = false }),
    seek: vi.fn((t: number) => { _currentTime = t }),
    getCurrentTime: vi.fn(() => _currentTime),
    getDuration: vi.fn(() => 120),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    getIsPlaying: vi.fn(() => _playing),
    destroy: vi.fn(),
  }
}

function createMockMetronome(): MetronomeScheduler {
  return {
    setEnabled: vi.fn(),
    setSfxVolume: vi.fn(),
    syncToTimeline: vi.fn(),
    hasPendingLatch: vi.fn(() => false),
    fireLatchNow: vi.fn(),
    getLoadError: vi.fn(() => null),
    destroy: vi.fn(),
  }
}

function mountEditor() {
  let editor: ReturnType<typeof useLyricsEditor>
  const wrapper = mount(
    defineComponent({
      setup() {
        editor = useLyricsEditor()
        return editor
      },
      template: '<div />',
    }),
  )
  return { wrapper, editor: editor! }
}

describe('useLyricsEditor', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    // Initialize audio transport so seekPlayback works in activateLine tests
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('initializes with null activeLineId and index 0', () => {
    const { editor } = mountEditor()
    expect(editor.activeLineId.value).toBeNull()
    expect(editor.activeWordIndex.value).toBe(0)
    expect(editor.splitBarMode.value).toBe('select')
  })

  it('activateLine sets activeLineId and resets activeWordIndex', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 1.0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    expect(editor.activeLineId.value).toBe('l1')
    expect(editor.activeWordIndex.value).toBe(0)
  })

  it('activateLine seeks to line startTime when available', () => {
    const store = useEditorStore()
    // Need to load audio so seekPlayback works
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 5.0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    expect(store.currentTime).toBe(5.0)
  })

  it('activateLine seeks to prev line last word endTime when no startTime', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'a', endTime: 3.0 }], startTime: 0 },
      { id: 'l2', words: [{ id: 'w2', text: 'b' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l2')
    expect(store.currentTime).toBe(3.0)
  })

  it('activateLine seeks to prev line startTime when prev has no word endTime', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'a' }], startTime: 2.0 },
      { id: 'l2', words: [{ id: 'w2', text: 'b' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l2')
    expect(store.currentTime).toBe(2.0)
  })

  it('activateLine does not seek when no time info available', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'a' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    expect(store.currentTime).toBe(0) // unchanged from initial
  })

  it('activateLine with invalid id does nothing', () => {
    const { editor } = mountEditor()
    editor.activateLine('nonexistent')
    expect(editor.activeLineId.value).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts"`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement composable skeleton**

Create `src/composables/useLyricsEditor.ts`:

```ts
import { computed, ref, watch } from 'vue'

import { useEditorStore } from '../stores/editor-store'

export type LyricsEditorContext = ReturnType<typeof useLyricsEditor>

export function useLyricsEditor() {
  const store = useEditorStore()

  const activeLineId = ref<string | null>(null)
  const activeWordIndex = ref(0)
  const splitBarMode = ref<'cut' | 'select'>('select')

  const activeLine = computed(() =>
    activeLineId.value
      ? store.project.lyrics.find((l) => l.id === activeLineId.value) ?? null
      : null,
  )

  function activateLine(lineId: string): void {
    const lyrics = store.project.lyrics
    const line = lyrics.find((l) => l.id === lineId)
    if (!line) return
    activeLineId.value = lineId
    activeWordIndex.value = 0

    // Seek strategy (spec §5 priority degradation)
    if (line.startTime !== undefined) {
      store.seekPlayback(line.startTime)
    } else {
      const lineIndex = lyrics.findIndex((l) => l.id === lineId)
      if (lineIndex > 0) {
        const prevLine = lyrics[lineIndex - 1]
        const prevLastWord = prevLine.words[prevLine.words.length - 1]
        if (prevLastWord?.endTime !== undefined) {
          store.seekPlayback(prevLastWord.endTime)
        } else if (prevLine.startTime !== undefined) {
          store.seekPlayback(prevLine.startTime)
        }
        // else: don't seek
      }
      // else: first line with no startTime, don't seek
    }
  }

  // Undo/Redo sync: re-derive activeWordIndex from data state
  watch(
    () => activeLine.value,
    (line) => {
      if (!line) return
      if (line.startTime === undefined) {
        activeWordIndex.value = 0
        return
      }
      const firstUndef = line.words.findIndex((w) => w.endTime === undefined)
      activeWordIndex.value =
        firstUndef === -1 ? line.words.length : firstUndef + 1
    },
  )

  return {
    activeLineId,
    activeWordIndex,
    splitBarMode,
    activeLine,
    activateLine,
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts"`
Expected: All PASS.

- [ ] **Step 6: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/components/shell/injection-keys.ts src/composables/useLyricsEditor.ts src/composables/useLyricsEditor.spec.ts
git commit -m "feat: add useLyricsEditor composable skeleton with activateLine

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Snap + Clamp Helpers

**Files:**
- Create: `src/core/lyrics/snap-time.ts`
- Create: `src/core/lyrics/snap-time.spec.ts`

This task implements the snap-to-grid + anti-overlap logic (spec §12) and the boundary clamp logic (spec §13) as pure functions, independent of Vue.

- [ ] **Step 1: Write failing tests**

Create `src/core/lyrics/snap-time.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { LyricWord, TimingPoint } from '../domain/project'
import { computeSnappedTime, clampWordTime } from './snap-time'

const points: TimingPoint[] = [
  { id: 'tp-1', time: 0, bpm: 120, timeSignatureNumerator: 4, timeSignatureDenominator: 4 },
]
// 120 BPM, divisor 4 → grid interval = 0.125s

describe('computeSnappedTime', () => {
  it('returns raw time when snap is disabled', () => {
    const result = computeSnappedTime({
      rawTime: 0.13,
      snapEnabled: false,
      timingPoints: points,
      divisor: 4,
      triplets: false,
      existingEndTimes: [],
    })
    expect(result).toBe(0.13)
  })

  it('snaps to nearest grid point when snap is enabled', () => {
    const result = computeSnappedTime({
      rawTime: 0.13,
      snapEnabled: true,
      timingPoints: points,
      divisor: 4,
      triplets: false,
      existingEndTimes: [],
    })
    expect(result).toBeCloseTo(0.125, 6)
  })

  it('finds alternative grid point when candidate is occupied', () => {
    const result = computeSnappedTime({
      rawTime: 0.13,
      snapEnabled: true,
      timingPoints: points,
      divisor: 4,
      triplets: false,
      existingEndTimes: [0.125], // candidate occupied
    })
    // Should find next nearest unoccupied grid point within radius
    // radius = 0.125 / 4 = 0.03125
    // candidates in [0.125-0.03125, 0.125+0.03125] = [0.09375, 0.15625]
    // 0.125 is occupied, no other grid point in this range → falls back to raw
    expect(result).toBe(0.13)
  })

  it('snaps to unoccupied nearby grid point if available', () => {
    // divisor=8 → grid interval = 0.0625s
    // grid points: 0, 0.0625, 0.125, 0.1875, 0.25
    // rawTime=0.13 → nearest is 0.125 (occupied) → try 0.1875 (within radius 0.0625/4=0.015625? No, radius too small)
    // Let's use divisor=2 → grid interval = 0.25s, radius = 0.0625
    // grid points: 0, 0.25, 0.5...
    // rawTime=0.26 → nearest is 0.25 (occupied)
    // radius = 0.25/4 = 0.0625 → search [0.1875, 0.3125]
    // no other grid point in this range → falls back to raw
    const result = computeSnappedTime({
      rawTime: 0.26,
      snapEnabled: true,
      timingPoints: points,
      divisor: 2,
      triplets: false,
      existingEndTimes: [0.25],
    })
    expect(result).toBe(0.26)
  })
})

describe('clampWordTime', () => {
  it('returns time unchanged when valid', () => {
    expect(clampWordTime(1.5, 0.5, 120)).toBe(1.5)
  })

  it('clamps to 0 when negative', () => {
    expect(clampWordTime(-0.5, undefined, 120)).toBe(0)
  })

  it('clamps to audioDuration when exceeded', () => {
    expect(clampWordTime(200, undefined, 120)).toBe(120)
  })

  it('clamps to prevEndTime + 0.001 when <= prevEndTime', () => {
    expect(clampWordTime(1.0, 1.0, 120)).toBeCloseTo(1.001, 6)
    expect(clampWordTime(0.5, 1.0, 120)).toBeCloseTo(1.001, 6)
  })

  it('returns prevEndTime + 0.001 when undefined prevEndTime and time is valid', () => {
    expect(clampWordTime(0.5, undefined, 120)).toBe(0.5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/core/lyrics/snap-time.spec.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement snap-time helpers**

Create `src/core/lyrics/snap-time.ts`:

```ts
import type { TimingPoint } from '../domain/project'
import { getActiveTimingPoint, snapToNearestGridPoint, getBeatGridLines } from '../timing/timing-engine'

export interface ComputeSnappedTimeOptions {
  rawTime: number
  snapEnabled: boolean
  timingPoints: readonly TimingPoint[]
  divisor: number
  triplets: boolean
  existingEndTimes: readonly number[]
}

const OCCUPIED_THRESHOLD = 0.001

function isOccupied(time: number, endTimes: readonly number[]): boolean {
  return endTimes.some((t) => Math.abs(t - time) < OCCUPIED_THRESHOLD)
}

export function computeSnappedTime(options: ComputeSnappedTimeOptions): number {
  const { rawTime, snapEnabled, timingPoints, divisor, triplets, existingEndTimes } = options
  if (!snapEnabled || timingPoints.length === 0) return rawTime

  const candidate = snapToNearestGridPoint(timingPoints, rawTime, divisor, triplets)

  if (!isOccupied(candidate, existingEndTimes)) return candidate

  // Anti-overlap: search within gridInterval/4 radius for an unoccupied grid point
  // Use the active timing point's BPM for the correct segment
  const activePoint = getActiveTimingPoint(timingPoints, rawTime)
  const beatDur = 60 / activePoint.bpm
  const actualDivisor = triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
  const gridInterval = beatDur / actualDivisor
  const radius = gridInterval / 4

  const searchStart = candidate - radius
  const searchEnd = candidate + radius
  const gridLines = getBeatGridLines(timingPoints, divisor, triplets, searchStart, searchEnd)

  let bestTime: number | null = null
  let bestDist = Infinity
  for (const gl of gridLines) {
    if (!isOccupied(gl.time, existingEndTimes) && Math.abs(gl.time - candidate) < bestDist) {
      bestDist = Math.abs(gl.time - candidate)
      bestTime = gl.time
    }
  }

  return bestTime ?? rawTime
}

export function clampWordTime(
  time: number,
  prevEndTime: number | undefined,
  audioDuration: number,
): number {
  let t = Math.max(0, Math.min(audioDuration, time))
  if (prevEndTime !== undefined && t <= prevEndTime) {
    t = prevEndTime + 0.001
  }
  return t
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/core/lyrics/snap-time.spec.ts"`
Expected: All PASS.

- [ ] **Step 5: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/core/lyrics/snap-time.ts src/core/lyrics/snap-time.spec.ts
git commit -m "feat: add computeSnappedTime and clampWordTime helpers

Implements spec §12 (snap + anti-overlap) and §13 (boundary clamp).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: D Key Handler

**Files:**
- Modify: `src/composables/useLyricsEditor.ts`
- Modify: `src/composables/useLyricsEditor.spec.ts`

- [ ] **Step 1: Write failing tests for D key**

Add to `src/composables/useLyricsEditor.spec.ts`:

```ts
describe('handleMarkKey (D)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handleMarkKey()
    expect(editor.activeWordIndex.value).toBe(0)
  })

  it('at index 0: sets line startTime and advances to 1', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }, { id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    // Simulate currentTime at 1.0
    // Note: snap is disabled in these tests (no timing points with snap enabled)
    editor.handleMarkKey(1.0)
    await nextTick()
    expect(store.project.lyrics[0].startTime).toBe(1.0)
    expect(editor.activeWordIndex.value).toBe(1)
  })

  it('at index 1: sets word[0].endTime and advances to 2', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }, { id: 'w2', text: 'world' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkKey(1.5)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(1.5)
    expect(editor.activeWordIndex.value).toBe(2)
  })

  it('at index N (last word): does nothing', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1 // N = words.length = 1
    editor.handleMarkKey(2.0)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })

  it('overwrites existing endTime (re-timing)', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello', endTime: 1.0 }, { id: 'w2', text: 'world' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkKey(2.0)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
  })

  it('clears endTime of subsequent words when time exceeds them', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'a' },
          { id: 'w2', text: 'b', endTime: 1.5 },
          { id: 'w3', text: 'c', endTime: 2.0 },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    // Set w1.endTime to 2.5, which exceeds w2.endTime(1.5) and w3.endTime(2.0)
    editor.handleMarkKey(2.5)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.5)
    expect(store.project.lyrics[0].words[1].endTime).toBeUndefined()
    expect(store.project.lyrics[0].words[2].endTime).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handleMarkKey"`
Expected: FAIL — `editor.handleMarkKey` is not a function.

- [ ] **Step 3: Implement handleMarkKey**

Add to `useLyricsEditor.ts` imports:

```ts
import { computeSnappedTime, clampWordTime } from '../core/lyrics/snap-time'
import { snapToNearestGridPoint } from '../core/timing/timing-engine'
```

Add a private helper and the handler:

```ts
function _getSnappedTime(rawTime: number): number {
  const line = activeLine.value
  if (!line) return rawTime
  const existingEndTimes = line.words
    .map((w) => w.endTime)
    .filter((t): t is number => t !== undefined)
  return computeSnappedTime({
    rawTime,
    snapEnabled: store.project.settings.snapEnabled,
    timingPoints: store.project.timingPoints,
    divisor: store.project.settings.snapDivisor,
    triplets: store.project.settings.rhythmMode === 'triplets',
    existingEndTimes,
  })
}

function _getPrevEndTime(wordIndex: number): number | undefined {
  const line = activeLine.value
  if (!line) return undefined
  if (wordIndex === 0) return line.startTime
  return line.words[wordIndex - 1]?.endTime
}

function handleMarkKey(currentTime?: number): void {
  if (!activeLineId.value) return
  const line = activeLine.value
  if (!line) return
  const N = line.words.length

  if (activeWordIndex.value >= N) return

  const rawTime = currentTime ?? store.currentTime

  if (activeWordIndex.value === 0) {
    const time = _getSnappedTime(rawTime)
    const clamped = clampWordTime(time, undefined, store.duration)
    store.setLineStartTime(activeLineId.value, clamped)
    activeWordIndex.value = 1
    // Start playback if paused (spec §5)
    if (!store.isPlaying) store.togglePlayback()
    return
  }

  const wordIndex = activeWordIndex.value - 1
  const word = line.words[wordIndex]
  if (!word) return

  const time = _getSnappedTime(rawTime)
  const prevEnd = _getPrevEndTime(wordIndex)
  const clamped = clampWordTime(time, prevEnd, store.duration)

  // Overflow check: clear subsequent words whose endTime <= clamped
  for (let k = wordIndex + 1; k < line.words.length; k++) {
    const w = line.words[k]
    if (w.endTime !== undefined && w.endTime <= clamped) {
      store.clearWordEndTime(activeLineId.value, w.id)
    } else {
      break
    }
  }

  store.setWordEndTime(activeLineId.value, word.id, clamped)
  activeWordIndex.value += 1
}
```

Add `handleMarkKey` to the return object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handleMarkKey"`
Expected: All PASS.

- [ ] **Step 5: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/composables/useLyricsEditor.ts src/composables/useLyricsEditor.spec.ts
git commit -m "feat: add handleMarkKey (D key) to useLyricsEditor

Implements D key state machine: set startTime at index 0, set word endTime
at index 1+, advance activeWordIndex, clear overflowed subsequent words.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Enter Key & Shift+D Handlers

**Files:**
- Modify: `src/composables/useLyricsEditor.ts`
- Modify: `src/composables/useLyricsEditor.spec.ts`

- [ ] **Step 1: Write failing tests for Enter key**

Add to `src/composables/useLyricsEditor.spec.ts`:

```ts
describe('handleNextLineKey (Enter)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handleNextLineKey()
    expect(editor.activeLineId.value).toBeNull()
  })

  it('does nothing on last line', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleNextLineKey(2.0)
    await nextTick()
    expect(editor.activeLineId.value).toBe('l1')
  })

  it('skips to next line without modifying current line if startTime undefined', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleNextLineKey(2.0)
    await nextTick()
    expect(editor.activeLineId.value).toBe('l2')
    expect(editor.activeWordIndex.value).toBe(0)
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })

  it('sets last word endTime and advances to next line', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleNextLineKey(2.0)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
    expect(editor.activeLineId.value).toBe('l2')
    expect(editor.activeWordIndex.value).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handleNextLineKey"`
Expected: FAIL — `editor.handleNextLineKey` is not a function.

- [ ] **Step 3: Implement handleNextLineKey**

Add to `useLyricsEditor.ts`:

```ts
function handleNextLineKey(currentTime?: number): void {
  if (!activeLineId.value) return
  const lyrics = store.project.lyrics
  const lineIndex = lyrics.findIndex((l) => l.id === activeLineId.value)
  if (lineIndex === -1 || lineIndex >= lyrics.length - 1) return
  const line = lyrics[lineIndex]
  const nextLine = lyrics[lineIndex + 1]

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

  activeLineId.value = nextLine.id
  activeWordIndex.value = 0
}
```

Add to return object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handleNextLineKey"`
Expected: All PASS.

- [ ] **Step 5: Write failing tests for Shift+D**

Add to spec:

```ts
describe('handleMarkNoAdvanceKey (Shift+D)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('sets endTime but does NOT advance activeWordIndex', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }, { id: 'w2', text: 'world' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkNoAdvanceKey(1.5)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(1.5)
    expect(editor.activeWordIndex.value).toBe(1) // NOT 2
  })

  it('at index 0: sets startTime but does NOT advance', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleMarkNoAdvanceKey(1.0)
    await nextTick()
    expect(store.project.lyrics[0].startTime).toBe(1.0)
    expect(editor.activeWordIndex.value).toBe(0) // NOT 1
  })

  it('at index N: does nothing', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkNoAdvanceKey(2.0)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handleMarkNoAdvanceKey"`
Expected: FAIL — not a function.

- [ ] **Step 7: Implement handleMarkNoAdvanceKey**

Add to `useLyricsEditor.ts`:

```ts
function handleMarkNoAdvanceKey(currentTime?: number): void {
  if (!activeLineId.value) return
  const line = activeLine.value
  if (!line) return
  const N = line.words.length

  if (activeWordIndex.value >= N) return

  const rawTime = currentTime ?? store.currentTime

  if (activeWordIndex.value === 0) {
    const time = _getSnappedTime(rawTime)
    const clamped = clampWordTime(time, undefined, store.duration)
    store.setLineStartTime(activeLineId.value, clamped)
    // Do NOT advance
    return
  }

  const wordIndex = activeWordIndex.value - 1
  const word = line.words[wordIndex]
  if (!word) return

  const time = _getSnappedTime(rawTime)
  const prevEnd = _getPrevEndTime(wordIndex)
  const clamped = clampWordTime(time, prevEnd, store.duration)

  // Overflow check same as handleMarkKey
  for (let k = wordIndex + 1; k < line.words.length; k++) {
    const w = line.words[k]
    if (w.endTime !== undefined && w.endTime <= clamped) {
      store.clearWordEndTime(activeLineId.value, w.id)
    } else {
      break
    }
  }

  store.setWordEndTime(activeLineId.value, word.id, clamped)
  // Do NOT advance
}
```

Add to return object.

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handleMarkNoAdvanceKey"`
Expected: All PASS.

- [ ] **Step 9: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/composables/useLyricsEditor.ts src/composables/useLyricsEditor.spec.ts
git commit -m "feat: add Enter and Shift+D handlers to useLyricsEditor

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Undo/Redo activeWordIndex Sync

**Files:**
- Modify: `src/composables/useLyricsEditor.spec.ts`

- [ ] **Step 1: Write tests for undo sync**

Add to spec:

```ts
describe('undo/redo activeWordIndex sync', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('resets to 0 when line startTime is undone', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }, { id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleMarkKey(1.0) // sets startTime, index → 1
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(1)

    store.undo() // reverts startTime
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(0)
  })

  it('derives index from first undefined endTime after undo', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'a' },
          { id: 'w2', text: 'b' },
          { id: 'w3', text: 'c' },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1

    editor.handleMarkKey(1.0) // w1.endTime = 1.0, index → 2
    await nextTick()
    editor.handleMarkKey(2.0) // w2.endTime = 2.0, index → 3
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(3)

    store.undo() // reverts w2.endTime
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(2) // first undefined = w2, index = 2

    store.undo() // reverts w1.endTime
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(1) // first undefined = w1, index = 1
  })

  it('sets index to N when all words have endTime (redo)', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1

    editor.handleMarkKey(1.0) // w1.endTime = 1.0
    await nextTick()
    store.undo()
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(1)

    store.redo()
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(1) // N = 1, all have endTime
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "undo/redo"`
Expected: All PASS (the watch was already implemented in Task 3).

If any fail, adjust the watch implementation in `useLyricsEditor.ts`. The watch on `activeLine` should already handle this since `store.undo()` triggers `history` → `project` → `activeLine` reactivity chain.

- [ ] **Step 3: Commit if new tests pass**

```bash
git add src/composables/useLyricsEditor.spec.ts
git commit -m "test: add undo/redo activeWordIndex sync tests

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Delete Line + C/V Key Handlers

**Files:**
- Modify: `src/composables/useLyricsEditor.ts`
- Modify: `src/composables/useLyricsEditor.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to spec:

```ts
describe('handleDeleteLine (Delete)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('removes active line and activates next', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleDeleteLine()
    await nextTick()
    expect(store.project.lyrics).toHaveLength(1)
    expect(editor.activeLineId.value).toBe('l2')
  })

  it('activates previous line if deleting last', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l2')
    editor.handleDeleteLine()
    await nextTick()
    expect(store.project.lyrics).toHaveLength(1)
    expect(editor.activeLineId.value).toBe('l1')
  })

  it('sets activeLineId to null if list becomes empty', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleDeleteLine()
    await nextTick()
    expect(store.project.lyrics).toHaveLength(0)
    expect(editor.activeLineId.value).toBeNull()
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handleDeleteLine()
    expect(editor.activeLineId.value).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handleDeleteLine"`
Expected: FAIL — not a function.

- [ ] **Step 3: Implement handleDeleteLine**

Add to `useLyricsEditor.ts`:

```ts
function handleDeleteLine(): void {
  if (!activeLineId.value) return
  const lyrics = store.project.lyrics
  const index = lyrics.findIndex((l) => l.id === activeLineId.value)
  if (index === -1) return

  store.removeLyricLine(activeLineId.value)

  // Re-read lyrics after removal
  const remaining = store.project.lyrics
  if (remaining.length === 0) {
    activeLineId.value = null
    activeWordIndex.value = 0
  } else if (index < remaining.length) {
    activeLineId.value = remaining[index].id
    activeWordIndex.value = 0
  } else {
    activeLineId.value = remaining[remaining.length - 1].id
    activeWordIndex.value = 0
  }
}
```

Add to return object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handleDeleteLine"`
Expected: All PASS.

- [ ] **Step 5: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/composables/useLyricsEditor.ts src/composables/useLyricsEditor.spec.ts
git commit -m "feat: add handleDeleteLine to useLyricsEditor

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Write failing tests for C key (play line interval)**

Add to spec:

```ts
describe('handlePlayLineInterval (C)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handlePlayLineInterval()
    expect(editor.activeLineId.value).toBeNull()
  })

  it('does nothing when line has no startTime', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handlePlayLineInterval()
    // currentTime stays at seek position from activateLine, not changed by C
  })

  it('seeks to line startTime when line has time range', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello', endTime: 3.0 }], startTime: 1.0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handlePlayLineInterval()
    expect(store.currentTime).toBe(1.0)
  })
})

describe('handlePlayWordInterval (V)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handlePlayWordInterval()
    expect(editor.activeLineId.value).toBeNull()
  })

  it('does nothing at index 0 (start block)', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello', endTime: 2.0 }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    // activeWordIndex = 0 (start block)
    editor.handlePlayWordInterval()
    // No seek since start block has no interval
  })

  it('seeks to word start when word has endTime', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'a', endTime: 1.0 },
          { id: 'w2', text: 'b', endTime: 2.0 },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 2 // targeting w2
    editor.handlePlayWordInterval()
    expect(store.currentTime).toBe(1.0) // w2 start = w1.endTime
  })
})
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handlePlayLineInterval"`
Expected: FAIL — not a function.

- [ ] **Step 8: Implement C and V key handlers**

Add to `useLyricsEditor.ts`:

```ts
function handlePlayLineInterval(): void {
  if (!activeLineId.value) return
  const line = activeLine.value
  if (!line || line.startTime === undefined) return
  const lastWord = line.words[line.words.length - 1]
  if (lastWord?.endTime === undefined) return
  store.seekPlayback(line.startTime)
  if (!store.isPlaying) store.togglePlayback()
}

function handlePlayWordInterval(): void {
  if (!activeLineId.value) return
  const line = activeLine.value
  if (!line) return
  if (activeWordIndex.value === 0 || activeWordIndex.value > line.words.length) return
  const wordIndex = activeWordIndex.value - 1
  const word = line.words[wordIndex]
  if (!word?.endTime) return
  const wordStart = wordIndex === 0 ? line.startTime : line.words[wordIndex - 1]?.endTime
  if (wordStart === undefined) return
  store.seekPlayback(wordStart)
  if (!store.isPlaying) store.togglePlayback()
}
```

Add both to return object.

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" -t "handlePlay"`
Expected: All PASS.

- [ ] **Step 10: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/composables/useLyricsEditor.ts src/composables/useLyricsEditor.spec.ts
git commit -m "feat: add Delete, C, V key handlers to useLyricsEditor

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Shortcut Registration + AppShell Wiring

**Files:**
- Modify: `src/composables/useEditorShortcuts.ts`
- Modify: `src/components/shell/AppShell.vue`

- [ ] **Step 1: Register lyrics shortcuts**

In `src/composables/useEditorShortcuts.ts`, add after existing registrations:

```ts
// Lyrics mode shortcuts
registry.register('D', 'lyrics.mark')
registry.register('Shift+D', 'lyrics.markNoAdvance')
registry.register('Enter', 'lyrics.nextLine')
registry.register('C', 'lyrics.playLineInterval')
registry.register('V', 'lyrics.playWordInterval')
registry.register('Delete', 'lyrics.deleteLine')
```

- [ ] **Step 2: Wire lyrics actions in AppShell**

In `src/components/shell/AppShell.vue`, add imports and wiring:

Add import:
```ts
import { useLyricsEditor } from '../../composables/useLyricsEditor'
import { LYRICS_EDITOR_KEY } from './injection-keys'
```

After `const editorMode = ref(...)`:
```ts
const lyricsEditor = useLyricsEditor()
provide(LYRICS_EDITOR_KEY, lyricsEditor)
```

In the `useEditorShortcuts` `onAction` handler, add lyrics mode cases:
```ts
} else if (action === 'lyrics.mark') {
  if (editorMode.value === 'lyrics') lyricsEditor.handleMarkKey()
} else if (action === 'lyrics.markNoAdvance') {
  if (editorMode.value === 'lyrics') lyricsEditor.handleMarkNoAdvanceKey()
} else if (action === 'lyrics.nextLine') {
  if (editorMode.value === 'lyrics') lyricsEditor.handleNextLineKey()
} else if (action === 'lyrics.deleteLine') {
  if (editorMode.value === 'lyrics') lyricsEditor.handleDeleteLine()
} else if (action === 'lyrics.playLineInterval') {
  if (editorMode.value === 'lyrics') lyricsEditor.handlePlayLineInterval()
} else if (action === 'lyrics.playWordInterval') {
  if (editorMode.value === 'lyrics') lyricsEditor.handlePlayWordInterval()
}
```

- [ ] **Step 3: Disable lyrics mode when no audio**

In `AppShell.vue`, update the mode switch handler. In MenuBar's `@switchMode`:
```ts
@switchMode="(mode) => { if (mode === 'lyrics' && !store.audioFile) return; editorMode = mode }"
```

In `MenuBar.vue`, add `audioLoaded` prop and disable lyrics button:
```ts
defineProps<{ mode: 'timing' | 'lyrics'; theme: 'light' | 'dark'; audioLoaded: boolean }>()
```

On the lyrics mode button, add `:disabled="!audioLoaded"`.

In `AppShell.vue` template:
```html
<MenuBar
  :mode="editorMode"
  :theme="theme"
  :audio-loaded="!!store.audioFile"
  @switchMode="(mode) => { if (mode === 'lyrics' && !store.audioFile) return; editorMode = mode }"
  ...
/>
```

- [ ] **Step 4: Run type check**

Run: `pnpm check`
Expected: No type errors.

- [ ] **Step 5: Run all tests**

Run: `pnpm test:run`
Expected: All PASS.

- [ ] **Step 6: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/composables/useEditorShortcuts.ts src/components/shell/AppShell.vue src/components/shell/MenuBar.vue
git commit -m "feat: wire lyrics shortcuts and disable lyrics mode without audio

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test:run`
Expected: All tests pass.

- [ ] **Step 2: Run type check + lint + build**

Run: `pnpm check && pnpm lint && pnpm build`
Expected: All clean.

---

## Verification

After completing all tasks:

1. `pnpm test:run` — all green
2. `pnpm check` — no type errors
3. `pnpm build` — succeeds
4. Auto-split utility tested: English splits by space, CJK stays intact
5. Store lyrics actions tested: insert, remove, setLineStartTime, setWordEndTime, clearWordEndTime, splitWord, mergeWords — all undoable
6. useLyricsEditor state machine tested: D key advance, Shift+D no advance, Enter next line, Delete line
7. Undo/redo sync: activeWordIndex correctly re-derived from data
8. Shortcuts registered: D, Shift+D, Enter, C, V, Delete — gated by editorMode === 'lyrics'
9. C key seeks to line start + plays; V key seeks to word start + plays
10. Snap + anti-overlap logic tested: computeSnappedTime + clampWordTime
11. Lyrics mode disabled when no audio loaded
12. activateLine seeks with 4-level priority degradation
