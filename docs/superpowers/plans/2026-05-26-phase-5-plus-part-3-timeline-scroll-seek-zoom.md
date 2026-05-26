# Timeline Scroll Seek Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Part 3 of `docs/phase-5-plus-stepped-spec.md`: playback follow thresholds, explicit seek scrolling, cursor-centered zoom, and a playback auto-follow toggle.

**Architecture:** Add a store-level explicit seek signal emitted from `seekPlayback()`. `useTimelineView` consumes that signal for seek scrolling, keeps playback following separate, and delegates pixel math to `WaveSurferView`.

**Tech Stack:** Vue 3 Composition API, Pinia, Vitest, Vue Test Utils, WaveSurfer v7 adapter.

---

### Task 1: Store Seek Signal

**Files:**
- Modify: `src/stores/editor-store.ts`
- Test: `src/stores/editor-store.spec.ts`

- [x] Add a failing test that `seekPlayback()` increments a public `seekRequest.version` and stores the clamped target time.
- [x] Run the store test and verify it fails because `seekRequest` does not exist.
- [x] Add `_seekRequestVersion`, `seekRequest`, and update them only after a successful loaded-audio seek.
- [x] Run the targeted store test and verify it passes.

### Task 2: WaveSurfer Scroll And Zoom API

**Files:**
- Modify: `src/platform/waveform/wavesurfer-view.ts`
- Test: `src/platform/waveform/wavesurfer-view.spec.ts`

- [x] Add failing tests for threshold-based `scrollPlaybackTo()`, explicit `scrollTo()` centering, and cursor-anchored `zoom()`.
- [x] Run the waveform adapter tests and verify the new tests fail.
- [x] Extend `WaveSurferView.zoom(pxPerSec, anchorClientX?)` and add `scrollPlaybackTo(time, thresholdRatio)`.
- [x] Run waveform adapter tests and verify they pass.

### Task 3: Timeline Composable Behavior

**Files:**
- Modify: `src/composables/useTimelineView.ts`
- Test: `src/composables/useTimelineView.spec.ts`

- [x] Add failing tests that explicit seeks call `scrollTo()`, playback follows only past the threshold and when enabled, and user scroll cooldown blocks playback follow only.
- [x] Run the composable tests and verify they fail.
- [x] Add `autoFollowPlayback`, `setAutoFollowPlayback()`, seekRequest watcher, and cursor-centered ctrl-wheel zoom forwarding.
- [x] Run composable tests and verify they pass.

### Task 4: TransportBar Toggle UI

**Files:**
- Modify: `src/components/shell/TransportBar.vue`
- Modify: `src/i18n/locales/zh-CN.json`
- Test: `src/components/shell/TransportBar.spec.ts`

- [x] Add failing tests for the auto-follow toggle rendering, active state, icon, title, and click behavior.
- [x] Run TransportBar tests and verify they fail.
- [x] Add a compact icon button using the injected timeline API.
- [x] Run TransportBar tests and verify they pass.

### Task 5: Verification

**Files:**
- All changed files.

- [x] Run targeted tests for store, waveform adapter, timeline composable, and TransportBar.
- [x] Run `pnpm lint`.
- [x] Run `pnpm format`.
- [x] Run `pnpm check`.
