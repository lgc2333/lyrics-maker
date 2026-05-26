# Overlay Partial Lines Hover Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 5 Plus Part 4 by showing partially timed lyric lines in the timeline overlay and adding a mouse-position time preview to the grid overlay.

**Architecture:** Keep timeline DOM behavior inside the existing platform WaveSurfer plugins. `LineOverlayPlugin` computes the visible continuous timed span for each line, while `GridOverlayPlugin` owns its hover preview elements and pointer listeners on the WaveSurfer wrapper. `useTimelineView` does not need new reactive state unless plugin wiring changes.

**Tech Stack:** TypeScript, WaveSurfer v7 plugins, Vitest + happy-dom, Vue 3 composable wiring.

---

### Task 1: Partial Lyric Line Rendering

**Files:**
- Modify: `src/platform/waveform/line-overlay-plugin.spec.ts`
- Modify: `src/platform/waveform/line-overlay-plugin.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that verify a line with `startTime` and only some words completed still renders, skips words missing `endTime`, bridges the visible timed span from the previous valid boundary to the next timed word, draws the completed-line end boundary when the final word has `endTime`, and uses a dashed separator as the last visible boundary when the final word is still missing `endTime`.

- [ ] **Step 2: Run tests to verify RED**

Run: `pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts"`

Expected: at least one new assertion fails because the plugin currently skips lines whose last word has no `endTime` and does not bridge across missing word timings.

- [ ] **Step 3: Implement minimal line span computation**

In `LineOverlayPlugin`, derive each line's renderable span by walking words from `line.startTime`, skipping words whose `endTime` is missing, and treating the next timed word as extending from the previous valid boundary. Render only when at least one word has `endTime`. Draw the blue line-end boundary whenever the final word has `endTime`; otherwise append a dashed yellow boundary at the final timed word end.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts"`

Expected: all line overlay tests pass.

### Task 2: Grid Pointer Time Preview

**Files:**
- Modify: `src/platform/waveform/grid-overlay-plugin.spec.ts`
- Modify: `src/platform/waveform/grid-overlay-plugin.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that verify the grid plugin creates a hidden hover preview layer, shows formatted time on `pointermove`, positions it in wrapper coordinates, clamps time to the audio duration, and hides it on `pointerleave`.

- [ ] **Step 2: Run tests to verify RED**

Run: `pnpm test:run "src/platform/waveform/grid-overlay-plugin.spec.ts"`

Expected: the new preview element queries or visibility assertions fail because the plugin has no hover preview.

- [ ] **Step 3: Implement minimal pointer preview**

In `GridOverlayPlugin`, create a DOM preview layer appended to the WaveSurfer wrapper with `pointer-events: none`. Set the SVG grid layer to keep ignoring pointer events. Subscribe to wrapper `pointermove` and `pointerleave`; on move, compute `time = (scrollLeft + clientX - scrollContainerRect.left) / pxPerSec`, clamp it to `[0, duration]`, format it with `formatTimestamp`, and update a vertical line plus label.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `pnpm test:run "src/platform/waveform/grid-overlay-plugin.spec.ts"`

Expected: all grid overlay tests pass.

### Task 3: Integration Verification

**Files:**
- Inspect: `src/composables/useTimelineView.ts`
- Inspect: `src/components/shell/MainView.vue`
- Modify only if tests reveal plugin wiring needs adjustment.

- [ ] **Step 1: Run targeted overlay and timeline tests**

Run: `pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts" "src/platform/waveform/grid-overlay-plugin.spec.ts" "src/composables/useTimelineView.spec.ts"`

Expected: all targeted tests pass.

- [ ] **Step 2: Run project checks required before completion**

Run: `pnpm lint`

Expected: exit 0.

Run: `pnpm format`

Expected: exit 0.

Run: `pnpm check`

Expected: exit 0.

- [ ] **Step 3: Review changed files**

Run: `git diff -- src/platform/waveform/line-overlay-plugin.ts src/platform/waveform/line-overlay-plugin.spec.ts src/platform/waveform/grid-overlay-plugin.ts src/platform/waveform/grid-overlay-plugin.spec.ts docs/superpowers/plans/2026-05-26-phase-5-plus-part-4-overlay-partial-lines-hover-preview.md`

Expected: diff contains only Part 4 overlay behavior, tests, and this plan.
