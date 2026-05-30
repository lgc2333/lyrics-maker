# Phase 5 Plus Part 11 Overlay Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct drag editing for lyric line and word timing boundaries on the WaveSurfer line overlay.

**Architecture:** `LineOverlayPlugin` remains Vue-free and emits drag intent events only. `useTimelineView` owns snap, clamp, preview updates, cleanup, and command-backed commits through `useEditorStore`. `useLyricsEditor` exposes a non-seeking `selectLine()` so overlay drag can activate rows without disturbing keyboard timing behavior.

**Tech Stack:** Vue 3 Composition API, Pinia, Vitest + happy-dom, WaveSurfer BasePlugin, existing command history and i18n status system.

---

## File Structure

- Create `src/core/lyrics/boundary-bounds.ts`: pure clamp-bound calculation and exported `BOUNDARY_DRAG_EPSILON`.
- Create `src/core/lyrics/boundary-bounds.spec.ts`: TDD coverage for all clamp-bound edge cases.
- Modify `src/platform/waveform/line-overlay-plugin.ts`: add drag intent types, drag preview params, hit areas, pointer state machine, preview rendering, and edge auto-scroll cleanup.
- Modify `src/platform/waveform/line-overlay-plugin.spec.ts`: expand platform-level DOM/event/preview tests.
- Modify `src/composables/useTimelineView.ts`: subscribe to overlay drag events, calculate snap + clamp, update preview, commit via existing store methods, suppress playback auto-follow during drag, and expose `onBoundaryDragStart`.
- Create `src/composables/useTimelineView.spec.ts`: composable drag orchestration tests with mocked WaveSurfer view and plugin.
- Modify `src/composables/useLyricsEditor.ts`: add `selectLine(lineId)` without seek.
- Modify `src/composables/useLyricsEditor.spec.ts`: add `selectLine` regression tests.
- Modify `src/components/shell/AppShell.vue`: wire overlay drag start to `lyricsEditor.selectLine(intent.lineId)`.
- Modify `src/components/shell/AppShell.spec.ts`: verify drag activation does not seek and does not select a word.
- Modify `src/i18n/locales/en-US.json` and `src/i18n/locales/zh-CN.json`: add drag status keys.
- Modify `docs/patterns/timeline-audio-lyrics.md`: add durable overlay drag contract notes.
- Modify `docs/phase-5-plus-stepped-spec.md`: mark Part 11 complete after verification passes.

## Task 1: Core Clamp Bounds

**Files:**
- Create: `src/core/lyrics/boundary-bounds.ts`
- Create: `src/core/lyrics/boundary-bounds.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests that import `getDragClampBounds` and `BOUNDARY_DRAG_EPSILON` from `./boundary-bounds`, build small `LyricLine[]` fixtures, and assert:

```ts
expect(getDragClampBounds({ kind: 'line-start', lineId: 'line-1' }, lyrics, 10)).toEqual({
  min: 0.001,
  max: 3.999,
})
expect(getDragClampBounds({ kind: 'word-separator', lineId: 'line-1', wordId: 'word-1' }, lyrics, 10)).toEqual({
  min: 1.001,
  max: 3.999,
})
expect(getDragClampBounds({ kind: 'line-end', lineId: 'line-1', wordId: 'word-2' }, lyrics, 10)).toEqual({
  min: 2.001,
  max: 7.999,
})
expect(getDragClampBounds({ kind: 'line-start', lineId: 'missing' }, lyrics, 10)).toEqual({
  min: 0,
  max: 10,
})
expect(getDragClampBounds({ kind: 'line-start', lineId: 'line-1' }, lyrics, 0)).toEqual({
  min: 0,
  max: 0,
})
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test:run "src/core/lyrics/boundary-bounds.spec.ts"`

Expected: FAIL because `src/core/lyrics/boundary-bounds.ts` does not exist.

- [ ] **Step 3: Implement pure helper**

Export these exact public shapes:

```ts
export const BOUNDARY_DRAG_EPSILON = 0.001

export type BoundaryDragIntent =
  | { kind: 'line-start'; lineId: string }
  | { kind: 'line-end'; lineId: string; wordId: string }
  | { kind: 'word-separator'; lineId: string; wordId: string }

export function getDragClampBounds(
  intent: BoundaryDragIntent,
  lyrics: readonly LyricLine[],
  duration: number,
): { min: number; max: number }
```

Implementation rules:

```ts
if (duration <= 0) return { min: 0, max: 0 }
const lineIndex = lyrics.findIndex((line) => line.id === intent.lineId)
if (lineIndex === -1) return { min: 0, max: duration }
```

Then compute raw min/max from previous line last timed word, current line start, neighboring word `endTime`, next line `startTime`, or `duration`, shrink by `BOUNDARY_DRAG_EPSILON`, clamp into `[0, duration]`, and normalize narrow intervals to midpoint when `max < min`.

- [ ] **Step 4: Verify helper passes**

Run: `pnpm test:run "src/core/lyrics/boundary-bounds.spec.ts"`

Expected: PASS.

## Task 2: Platform Overlay Drag Events And Preview

**Files:**
- Modify: `src/platform/waveform/line-overlay-plugin.ts`
- Modify: `src/platform/waveform/line-overlay-plugin.spec.ts`

- [ ] **Step 1: Write failing plugin tests**

Extend the existing spec to cover:

```ts
expect(layer.querySelector('[data-testid="boundary-handle-line-start-line-1"]')).not.toBeNull()
expect(layer.querySelector('[data-testid="boundary-handle-line-end-line-1"]')).not.toBeNull()
expect(layer.querySelector('[data-testid="boundary-handle-word-separator-word-1"]')).not.toBeNull()
```

Register event listeners with:

```ts
plugin.on('boundaryDragStart', startSpy)
plugin.on('boundaryDragMove', moveSpy)
plugin.on('boundaryDragEnd', endSpy)
plugin.on('boundaryDragCancel', cancelSpy)
```

Dispatch pointer events on a handle and assert emitted intents and raw times, including a scrolled wrapper case where `clientX - wrapper.getBoundingClientRect().left` is not double-counted.

- [ ] **Step 2: Verify plugin tests fail**

Run: `pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts"`

Expected: FAIL because handles/events/preview do not exist.

- [ ] **Step 3: Implement overlay types and params**

Change the plugin generic to use a new event interface:

```ts
export interface DragPreview {
  intent: BoundaryDragIntent
  time: number
}

interface LineOverlayEvents extends BasePluginEvents {
  boundaryDragStart: [{ intent: BoundaryDragIntent }]
  boundaryDragMove: [{ intent: BoundaryDragIntent; rawTime: number }]
  boundaryDragEnd: [{ intent: BoundaryDragIntent; rawTime: number }]
  boundaryDragCancel: [{ intent: BoundaryDragIntent }]
}
```

Add `duration?: number` and `dragPreview?: DragPreview` to `LineOverlayParams`.

- [ ] **Step 4: Implement handles and pointer state**

Add transparent 10px hit areas with `pointerEvents: 'auto'`, `cursor: 'ew-resize'`, and stable `data-testid`. On pointerdown, call `setPointerCapture`, emit `boundaryDragStart`, store intent and `lastClientX`. On move/up/Escape, emit the corresponding events. Use:

```ts
const contentX = clientX - wrapper.getBoundingClientRect().left
return Math.max(0, Math.min(duration, contentX / pxPerSec))
```

Do not render ambiguous separator handles when the previous word has no `endTime`.

- [ ] **Step 5: Implement preview and auto-scroll**

During `_draw()`, if `params.dragPreview` matches a boundary, use the preview time for that boundary and update the affected range, word labels, and selected ranges. Add a preview highlight element with `data-testid="boundary-handle-drag-preview"`. Add edge auto-scroll RAF using 40px edge zone and max 12px per frame; stop RAF on pointerup, cancel, and destroy.

- [ ] **Step 6: Verify plugin passes**

Run: `pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts"`

Expected: PASS.

## Task 3: Timeline Drag Orchestration

**Files:**
- Modify: `src/composables/useTimelineView.ts`
- Create: `src/composables/useTimelineView.spec.ts`

- [ ] **Step 1: Use required Vue skills**

Before editing this task, load `vue-best-practices`, `vue-pinia-best-practices`, and `vue-testing-best-practices`.

- [ ] **Step 2: Write failing composable tests**

Mock `createWaveSurferView` so `registerPlugin()` returns the supplied plugin and exposes `on`, `loadBlob`, `destroy`, `scrollPlaybackTo`, `scrollSeekTo`, `scrollByDelta`, `zoom`, `getScrollTime`, `scrollTo`, `syncContainerHeight`, and `setContainerHeight`. Mock `LineOverlayPlugin.create()` with a small event emitter exposing `on`, `emit`, and `update`.

Cover:

```ts
plugin.emit('boundaryDragStart', { intent })
expect(onBoundaryDragStart).toHaveBeenCalledWith(intent)
plugin.emit('boundaryDragMove', { intent, rawTime: 3.98 })
expect(plugin.update).toHaveBeenLastCalledWith(expect.objectContaining({
  dragPreview: expect.objectContaining({ intent, time: expect.any(Number) }),
}))
plugin.emit('boundaryDragEnd', { intent, rawTime: 3.98 })
expect(store.project.lyrics[0].words[0].endTime).toBeCloseTo(4)
```

Also cover duration `<= 0`, missing targets, cancel, no-op movement, final status key, and auto-follow suppression.

- [ ] **Step 3: Verify composable tests fail**

Run: `pnpm test:run "src/composables/useTimelineView.spec.ts"`

Expected: FAIL because drag orchestration does not exist.

- [ ] **Step 4: Implement drag session**

Add:

```ts
let dragSession: {
  intent: BoundaryDragIntent
  originalTime: number
  lastSnappedTime: number
} | null = null
let suppressAutoFollow = false
let lineOverlayDragUnsubscribers: Array<() => void> = []
```

Implement `_readTimeForIntent`, `_collectExistingEndTimes`, `_teardownLineOverlayDragSubscriptions`, `_subscribeLineOverlayDragEvents`, `_handleBoundaryDragStart`, `_handleBoundaryDragMove`, `_handleBoundaryDragEnd`, `_handleBoundaryDragCancel`, and `_commitBoundary`.

- [ ] **Step 5: Wire snap, clamp, preview, commit**

Use `computeSnappedTime`, `getDragClampBounds`, and `BOUNDARY_DRAG_EPSILON`. On move, update plugin with `{ ..._buildLineOverlayParams(), dragPreview: { intent, time: clamped } }`. On end, re-check target existence, skip changes below epsilon, then call `store.setLineStartTime` or `store.setWordEndTime` and immediately overwrite command status with `status.lyrics.dragLineStart`, `status.lyrics.dragLineEnd`, or `status.lyrics.dragWordEnd`.

- [ ] **Step 6: Wire cleanup**

Call `_subscribeLineOverlayDragEvents(lineOverlayPlugin)` after plugin creation. Call teardown and clear drag state in `setViewMode()` before destroy and in `onUnmounted()`. Add `&& !suppressAutoFollow` to playback auto-follow.

- [ ] **Step 7: Verify composable passes**

Run: `pnpm test:run "src/composables/useTimelineView.spec.ts"`

Expected: PASS.

## Task 4: Lyrics Editor And AppShell Wiring

**Files:**
- Modify: `src/composables/useLyricsEditor.ts`
- Modify: `src/composables/useLyricsEditor.spec.ts`
- Modify: `src/components/shell/AppShell.vue`
- Modify: `src/components/shell/AppShell.spec.ts`

- [ ] **Step 1: Write failing lyrics editor tests**

Add tests that call `selectLine(lineId)` and assert it does not call `store.seekPlayback`, preserves `activeWordIndex` for same-line selection, and resets `activeWordIndex` to `0` for cross-line selection.

- [ ] **Step 2: Implement `selectLine`**

Add to `useLyricsEditor`:

```ts
function selectLine(lineId: string): void {
  if (activeLineId.value === lineId) return
  const line = store.project.lyrics.find((l) => l.id === lineId)
  if (!line) return
  _suppressWatchSync = true
  activeLineId.value = lineId
  activeWordIndex.value = 0
}
```

Return `selectLine` from the composable.

- [ ] **Step 3: Wire AppShell**

Pass an option to `useTimelineView`:

```ts
onBoundaryDragStart: (intent) => lyricsEditor.selectLine(intent.lineId),
```

Keep existing explicit seek selection behavior unchanged.

- [ ] **Step 4: Verify wiring tests**

Run:

```bash
pnpm test:run "src/composables/useLyricsEditor.spec.ts"
pnpm test:run "src/components/shell/AppShell.spec.ts"
```

Expected: PASS.

## Task 5: I18n, Docs, And Phase Marker

**Files:**
- Modify: `src/i18n/locales/en-US.json`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `docs/patterns/timeline-audio-lyrics.md`
- Modify: `docs/phase-5-plus-stepped-spec.md`

- [ ] **Step 1: Add status strings**

Add these keys under `status.lyrics`:

```json
"dragLineStart": "Adjusted line start to {time} by dragging",
"dragLineEnd": "Adjusted line end to {time} by dragging",
"dragWordEnd": "Adjusted word boundary to {time} by dragging"
```

For `zh-CN`, use:

```json
"dragLineStart": "已通过拖拽调整该行开始时间至 {time}",
"dragLineEnd": "已通过拖拽调整该行结束时间至 {time}",
"dragWordEnd": "已通过拖拽调整词边界至 {time}"
```

- [ ] **Step 2: Add durable pattern notes**

Append two bullets to `docs/patterns/timeline-audio-lyrics.md`:

```md
- **LineOverlay drag editing is intent-only in platform code.** The plugin emits boundary drag events with line/word ids and raw time; Vue composables perform snap, clamp, command dispatch, and status feedback.
- **Overlay drag preview is data-shaped but not project data.** Pass `dragPreview` into `LineOverlayPlugin.update()` for temporary rendering and clear it on commit, cancel, plugin recreate, and unmount.
```

- [ ] **Step 3: Mark phase complete**

In `docs/phase-5-plus-stepped-spec.md`, mark Part 11 as implemented only after all verification commands pass.

## Task 6: Full Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm test:run "src/core/lyrics/boundary-bounds.spec.ts"
pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts"
pnpm test:run "src/composables/useTimelineView.spec.ts"
pnpm test:run "src/composables/useLyricsEditor.spec.ts"
pnpm test:run "src/components/shell/AppShell.spec.ts"
```

Expected: all PASS.

- [ ] **Step 2: Run project verification**

Run:

```bash
pnpm lint
pnpm format
pnpm check
pnpm test:run
```

Expected: all PASS.

- [ ] **Step 3: Review diff**

Run:

```bash
git diff -- src/core/lyrics src/platform/waveform src/composables src/components/shell src/i18n docs
```

Expected: diff only contains Part 11 implementation, tests, i18n, and docs updates.

## Self-Review

- Spec coverage: all spec sections map to Tasks 1-6, including platform/store boundary, snap/clamp, status feedback, cancel/no-op, auto-scroll, cleanup, keyboard flow preservation, and tests.
- Placeholder scan: no TBD/TODO/later placeholders remain.
- Type consistency: `BoundaryDragIntent`, `DragPreview`, `BOUNDARY_DRAG_EPSILON`, and `getDragClampBounds` names are consistent across tasks.
