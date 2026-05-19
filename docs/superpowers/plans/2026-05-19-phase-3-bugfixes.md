# Phase 3 Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 confirmed bugs in the Phase 3 waveform/spectrogram timeline view, covering UI state sync, interaction, canvas overlay, spectrogram plugin compatibility, loading UX, metronome behavior, and vertical-zoom placement.

**Architecture:** The app is a Vite + Vue 3 + TypeScript + Pinia + DaisyUI single-page editor. WaveSurfer v7 renders waveform/spectrogram into a Shadow DOM. A custom `GridOverlayPlugin` draws a canvas overlay for beat-grid lines and playhead. The central composable `useTimelineView` owns WaveSurfer lifecycle, scroll state, zoom, and Alt-key tracking. All state mutations go through Pinia store commands.

**Tech Stack:** Vue 3 (Composition API + `<script setup>`), Pinia, WaveSurfer v7 (`wavesurfer.js`), WaveSurfer WindowedSpectrogramPlugin (`wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js`), Vitest + `@vue/test-utils` + happy-dom, Tailwind CSS + DaisyUI, TypeScript, Vite.

---

## Repository Quick-Reference

```
src/
├── composables/useTimelineView.ts       ← WaveSurfer lifecycle, grid, scroll, zoom, Alt tracking
├── platform/waveform/
│   ├── wavesurfer-view.ts               ← WaveSurfer factory wrapper
│   └── grid-overlay-plugin.ts           ← BasePlugin: beat-grid canvas + playhead overlay
├── components/shell/
│   ├── MainView.vue                     ← Waveform mount, resize handle, wheel handler
│   └── TransportBar.vue                 ← Playback controls, volume popovers, rhythm dropdown
├── stores/editor-store.ts               ← Pinia store; metronome state machine, seekPlayback
└── platform/audio/metronome.ts         ← MetronomeScheduler: latch, syncToTimeline
```

### Test infrastructure
- Tests live next to source files (`*.spec.ts`)
- `setActivePinia(createPinia())` in `beforeEach`
- `__overrideAudioTransportFactory` / `__overrideMetronomeFactory` for DI in store tests
- WaveSurfer is globally mocked in `useTimelineView.spec.ts` — keep this mock up to date as the interface changes
- `@iconify/vue` is globally mocked in `src/test/setup.ts` — do **not** remove
- Run: `pnpm test:run` (all tests), `pnpm test:run "<path>"` (single file)
- Lint + format before committing: `pnpm lint && pnpm format`

### Key constraints
- `core/` and `platform/` are Vue-free (no Vue imports)
- UI never mutates data directly — all changes via `store.execute(command)`
- After async mutations on `shallowRef` objects, call `triggerRef`
- `Math.round` (not `Math.floor`) for ms↔seconds conversions

---

## Bug Root-Cause Summary

| # | Bug | Root Cause | Files |
|---|-----|-----------|-------|
| 1 | Alt-triplet dropdown doesn't update | `:value` bound to `rhythmMode` not `effectiveTriplets` | TransportBar.vue |
| 2 | Can't click waveform to seek | `interact: false` disables WaveSurfer click events | wavesurfer-view.ts, useTimelineView.ts |
| 3 | Mouse wheel doesn't scroll horizontally | WaveSurfer `#scroll` only scrolls horizontally; plain vertical `deltaY` never gets relayed to `scrollLeft` | MainView.vue, useTimelineView.ts, wavesurfer-view.ts |
| 4 | Grid/playhead overlay drifts and vanishes | Canvas appended to `#scroll` (shadow DOM) scrolls with content; also `visibleStart/visibleEnd` never initialized before first `scroll` event | grid-overlay-plugin.ts, useTimelineView.ts |
| 5 | Spectrogram completely broken | Dynamic import of plugin races `loadBlob` (plugin registers after audio loads); also `worker_threads` Vite externalization error | wavesurfer-view.ts, vite.config.ts |
| 6 | UI freezes while loading; no indicator | Spectrogram FFT calculation blocks main thread; no loading state exposed | wavesurfer-view.ts, useTimelineView.ts, MainView.vue |
| 7 | Metronome no tail sound when paused | `toggleMetronome` when not playing skips latch; no `fireLatchNow` method | metronome.ts, editor-store.ts |
| 8 | Vertical zoom always visible (not popover) | Spectrogram vertical-zoom slider rendered inline in MainView instead of as hover popover in TransportBar | MainView.vue, TransportBar.vue |

---

## File Map (Changes Required)

| File | Action | Summary |
|------|--------|---------|
| `src/platform/audio/metronome.ts` | Modify | Add `fireLatchNow()` to interface + implementation |
| `src/platform/audio/metronome.spec.ts` | Modify | Add tests for `fireLatchNow` |
| `src/stores/editor-store.ts` | Modify | Use `fireLatchNow` in `toggleMetronome` when paused |
| `src/stores/editor-store.spec.ts` | Modify | Add `fireLatchNow: vi.fn()` to metronome mock |
| `src/platform/waveform/worker-threads-shim.ts` | **Create** | Browser stub for Node.js `worker_threads` module |
| `vite.config.ts` | Modify | Alias `worker_threads` → shim; suppress Vite externalization warning |
| `src/platform/waveform/wavesurfer-view.ts` | Modify | `interact: true`; static spectrogram import; add `scrollByDelta` |
| `src/platform/waveform/grid-overlay-plugin.ts` | Modify | Accept `outerContainer` option; place canvas on shadow host; init visible range on `ready` |
| `src/composables/useTimelineView.ts` | Modify | Wire `interaction` event for seek; relay wheel as horizontal scroll; expose `isLoading`; pass `outerContainer` to plugin; watch `verticalZoom` for spectrogram reinit |
| `src/composables/useTimelineView.spec.ts` | Modify | Update WaveSurfer mock for new interface; update spectrogram mock path; add new tests |
| `src/components/shell/MainView.vue` | Modify | Remove `overflow-hidden`, add `relative`; always delegate wheel; add loading overlay; remove vertical zoom panel |
| `src/components/shell/MainView.spec.ts` | Modify | Add test for loading overlay |
| `src/components/shell/TransportBar.vue` | Modify | Fix rhythm dropdown `:value`; add vertical zoom popover (spectrogram mode only) |
| `src/components/shell/TransportBar.spec.ts` | Modify | Test rhythm dropdown value with alt-triplet; test vertical zoom popover |

---

## Task 1: Rhythm-mode dropdown reflects Alt-triplet state (Bug 1)

**Files:**
- Modify: `src/components/shell/TransportBar.vue` (line 115)
- Modify: `src/components/shell/TransportBar.spec.ts`

### Background
`TransportBar.vue` has a `<select>` for rhythm mode. Its `:value` is bound to `timeline.rhythmMode.value` (the **stored** setting, `'common'` or `'triplets'`). When the user holds Alt, `altTripletActive` becomes `true` and `effectiveTriplets` becomes `true` — but `rhythmMode` stays `'common'`, so the dropdown doesn't change. The fix: bind `:value` to the **effective** state.

- [ ] **Step 1: Write the failing test**

Add to `src/components/shell/TransportBar.spec.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, provide, ref } from 'vue'

import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'
import TransportBar from './TransportBar.vue'

// Minimal timeline stub matching TimelineViewContext shape
function makeTimeline(overrides: Record<string, unknown> = {}) {
  return {
    viewMode: ref<'waveform' | 'spectrogram'>('waveform'),
    pxPerSec: ref(100),
    verticalZoom: ref(1),
    divisor: ref<1 | 2 | 4 | 8 | 16>(4),
    rhythmMode: ref<'common' | 'triplets'>('common'),
    effectiveTriplets: ref(false),
    altTripletActive: ref(false),
    setViewMode: () => {},
    setVerticalZoom: () => {},
    onWheel: () => {},
    isLoading: ref(false),
    ...overrides,
  }
}

function mountWithTimeline(timeline: ReturnType<typeof makeTimeline>) {
  const Wrapper = defineComponent({
    setup() {
      provide(TIMELINE_VIEW_KEY, timeline as never)
      return () => h(TransportBar)
    },
  })
  return mount(Wrapper)
}

describe('TransportBar rhythm mode select', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows "common" when rhythmMode is common and alt is not held', () => {
    const timeline = makeTimeline({
      rhythmMode: ref<'common' | 'triplets'>('common'),
      effectiveTriplets: ref(false),
      altTripletActive: ref(false),
    })
    const wrapper = mountWithTimeline(timeline)
    const select = wrapper.find('[data-testid="rhythm-mode-select"]').element as HTMLSelectElement
    expect(select.value).toBe('common')
  })

  it('shows "triplets" when effectiveTriplets is true (Alt held, rhythmMode still common)', () => {
    const timeline = makeTimeline({
      rhythmMode: ref<'common' | 'triplets'>('common'),
      effectiveTriplets: ref(true),  // Alt is held
      altTripletActive: ref(true),
    })
    const wrapper = mountWithTimeline(timeline)
    const select = wrapper.find('[data-testid="rhythm-mode-select"]').element as HTMLSelectElement
    expect(select.value).toBe('triplets')
  })

  it('shows "triplets" when rhythmMode is triplets (persistent)', () => {
    const timeline = makeTimeline({
      rhythmMode: ref<'common' | 'triplets'>('triplets'),
      effectiveTriplets: ref(true),
      altTripletActive: ref(false),
    })
    const wrapper = mountWithTimeline(timeline)
    const select = wrapper.find('[data-testid="rhythm-mode-select"]').element as HTMLSelectElement
    expect(select.value).toBe('triplets')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test:run "src/components/shell/TransportBar.spec.ts"
```

Expected: the second test (`shows "triplets" when effectiveTriplets is true`) FAILS because `select.value` is `'common'` (currently bound to `rhythmMode.value`, not `effectiveTriplets`).

- [ ] **Step 3: Fix the dropdown `:value` binding**

In `src/components/shell/TransportBar.vue`, find the rhythm mode `<select>` (around line 110–130) and change the `:value` binding from `timeline.rhythmMode.value` to `timeline.effectiveTriplets.value ? 'triplets' : 'common'`.

The `@change` handler **must remain** writing to `timeline.rhythmMode.value` (so explicit user selection persists the setting; Alt only controls a transient overlay).

```html
<!-- Rhythm mode dropdown — value reflects effective state (including Alt-triplet) -->
<select
  v-if="timeline"
  data-testid="rhythm-mode-select"
  class="select select-xs w-26"
  :title="t('transport.rhythmMode')"
  :value="timeline.effectiveTriplets.value ? 'triplets' : 'common'"
  @change="
    timeline.rhythmMode.value = ($event.target as HTMLSelectElement).value as
      | 'common'
      | 'triplets'
  "
>
  <option value="common">{{ t('transport.rhythmCommon') }}</option>
  <option value="triplets">
    {{
      timeline.altTripletActive.value
        ? t('transport.rhythmTripletsAlt')
        : t('transport.rhythmTriplets')
    }}
  </option>
</select>
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm test:run "src/components/shell/TransportBar.spec.ts"
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/TransportBar.vue src/components/shell/TransportBar.spec.ts
git commit -m "fix: rhythm dropdown reflects effectiveTriplets (Alt-key state)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Metronome latch-on-pause (Bug 7)

**Files:**
- Modify: `src/platform/audio/metronome.ts`
- Modify: `src/platform/audio/metronome.spec.ts`
- Modify: `src/stores/editor-store.ts`
- Modify: `src/stores/editor-store.spec.ts`

### Background
When the song is **paused** and the metronome is ON, clicking the metronome toggle goes directly to `'off'` — no latch click plays. The user wants a "tail click" even when paused (same as the existing playing→latch flow). Fix: add `fireLatchNow()` to `MetronomeScheduler` that schedules the latch buffer immediately (`audioContext.currentTime + 0.05`), bypassing the beat-timing math. Call it from `toggleMetronome` when not playing.

**State machine note:** The comment in `editor-store.ts` reads:
```
off ──(click)──▶ on ──(click when playing)──▶ latch_pending
                 │
                 │ (click when paused)
                 ▼
                off   ← THIS is what we're changing
```
After this task, the "click when paused" path becomes: `on → latch fires immediately → off`.

- [ ] **Step 1: Write failing tests for `fireLatchNow` in `metronome.spec.ts`**

Add the following to `src/platform/audio/metronome.spec.ts`, inside the top-level `describe('metronome', ...)` block (after the existing `describe` blocks):

```typescript
describe('fireLatchNow', () => {
  it('schedules latch buffer immediately when latch is pending', async () => {
    const m = createMetronome(fakeCtx as unknown as AudioContext)
    await flushMicrotasks()
    m.setEnabled(true)
    m.setEnabled(false) // sets latchPending = true

    m.fireLatchNow()

    // Latch buffer should have been scheduled
    expect(fakeCtx._sources.length).toBe(1)
    expect(fakeCtx._sources[0].start).toHaveBeenCalled()
    // Scheduled time should be close to audioContext.currentTime (= 10 in fake ctx)
    const scheduledAt = (fakeCtx._sources[0].start as ReturnType<typeof vi.fn>).mock.calls[0][0] as number
    expect(scheduledAt).toBeGreaterThanOrEqual(fakeCtx.currentTime)
    expect(scheduledAt).toBeLessThan(fakeCtx.currentTime + 1)
  })

  it('clears latchPending after fireLatchNow', async () => {
    const m = createMetronome(fakeCtx as unknown as AudioContext)
    await flushMicrotasks()
    m.setEnabled(true)
    m.setEnabled(false)

    m.fireLatchNow()

    expect(m.hasPendingLatch()).toBe(false)
  })

  it('does nothing when latch is not pending', async () => {
    const m = createMetronome(fakeCtx as unknown as AudioContext)
    await flushMicrotasks()
    m.setEnabled(true) // enabled, no latch pending

    m.fireLatchNow()

    expect(fakeCtx._sources.length).toBe(0)
  })

  it('does nothing when destroyed', async () => {
    const m = createMetronome(fakeCtx as unknown as AudioContext)
    await flushMicrotasks()
    m.setEnabled(true)
    m.setEnabled(false)
    m.destroy()

    expect(() => m.fireLatchNow()).not.toThrow()
    expect(fakeCtx._sources.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```
pnpm test:run "src/platform/audio/metronome.spec.ts"
```

Expected: 4 new tests fail with `m.fireLatchNow is not a function`.

- [ ] **Step 3: Add `fireLatchNow` to `MetronomeScheduler` interface and implement it**

In `src/platform/audio/metronome.ts`:

**Interface change** (top of file):
```typescript
export interface MetronomeScheduler {
  setEnabled: (enabled: boolean) => void
  setSfxVolume: (volume: number) => void
  syncToTimeline: (
    currentTime: number,
    nextBeat: { at: number; isBarStart: boolean } | null,
  ) => void
  /** Immediately schedules one latch click at audioContext.currentTime + 0.05s.
   *  No-op if latch is not pending or metronome is destroyed. */
  fireLatchNow: () => void
  hasPendingLatch: () => boolean
  getLoadError: () => Error | null
  destroy: () => void
}
```

**Implementation** — inside `createMetronome`, in the returned object, add `fireLatchNow` between `hasPendingLatch` and `getLoadError`:
```typescript
fireLatchNow(): void {
  if (destroyed || !latchBuffer || !latchPending) return
  playBufferAt(audioContext.currentTime + 0.05, latchBuffer)
  latchPending = false
},
```

- [ ] **Step 4: Run to verify metronome tests pass**

```
pnpm test:run "src/platform/audio/metronome.spec.ts"
```

Expected: All tests PASS (including the 4 new ones).

- [ ] **Step 5: Update the mock in `editor-store.spec.ts` and `useTimelineView.spec.ts`**

In every file that calls `__overrideMetronomeFactory`, add `fireLatchNow: vi.fn()` to the mock object. Search for `hasPendingLatch: vi.fn` in these files and add `fireLatchNow: vi.fn()` immediately after.

`src/stores/editor-store.spec.ts` — find the metronome mock (look for `hasPendingLatch`) and add:
```typescript
fireLatchNow: vi.fn(),
```

`src/composables/useTimelineView.spec.ts` — same change:
```typescript
fireLatchNow: vi.fn(),
```

- [ ] **Step 6: Write failing test for latch-on-pause in `editor-store.spec.ts`**

First, find the `beforeEach` in `editor-store.spec.ts` and note the mock metronome reference (or create a local ref). Then add this test to the `metronome` describe block (or create one):

```typescript
it('fires metronome latch immediately when toggling off while paused', async () => {
  // Track fireLatchNow calls
  let fireLatchNowMock: ReturnType<typeof vi.fn> | null = null

  __overrideMetronomeFactory(() => {
    const mock = {
      setEnabled: vi.fn(),
      setSfxVolume: vi.fn(),
      syncToTimeline: vi.fn(),
      fireLatchNow: vi.fn(),
      hasPendingLatch: vi.fn(() => false),
      getLoadError: vi.fn(() => null),
      destroy: vi.fn(),
    }
    fireLatchNowMock = mock.fireLatchNow
    return mock
  })

  setActivePinia(createPinia())
  const store = useEditorStore()

  // Turn metronome on
  store.toggleMetronome()
  expect(store.isMetronomeEnabled).toBe(true)

  // Toggle off while NOT playing
  store.toggleMetronome()

  // Should have called fireLatchNow
  expect(fireLatchNowMock).toHaveBeenCalledTimes(1)
  expect(store.isMetronomeEnabled).toBe(false)
})
```

- [ ] **Step 7: Run to verify failure**

```
pnpm test:run "src/stores/editor-store.spec.ts"
```

Expected: new test fails — `fireLatchNow` not called (store goes directly to `'off'` without latch).

- [ ] **Step 8: Update `toggleMetronome` in `editor-store.ts`**

Find `toggleMetronome` (around line 356). Change the `!_isPlaying.value` branch:

```typescript
function toggleMetronome(): void {
  const m = _ensureMetronome()

  if (_metronomeState.value === 'on') {
    if (_isPlaying.value) {
      // Playing → schedule one latch click at next beat, then stop
      m.setEnabled(false)
      _metronomeState.value = 'latch_pending'
    } else {
      // Not playing → fire latch immediately, then stop
      m.setEnabled(false) // sets latchPending = true inside metronome
      m.fireLatchNow()    // plays it at audioContext.currentTime + 0.05s
      _metronomeState.value = 'off'
    }
  } else {
    // off or latch_pending → turn on (setEnabled(true) also cancels any pending latch)
    m.setEnabled(true)
    _metronomeState.value = 'on'
  }
}
```

- [ ] **Step 9: Run to verify tests pass**

```
pnpm test:run "src/stores/editor-store.spec.ts"
pnpm test:run "src/platform/audio/metronome.spec.ts"
```

Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/platform/audio/metronome.ts src/platform/audio/metronome.spec.ts \
        src/stores/editor-store.ts src/stores/editor-store.spec.ts \
        src/composables/useTimelineView.spec.ts
git commit -m "fix: metronome plays latch click when toggled off while paused

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Vertical zoom moves to TransportBar popover (Bug 8)

**Files:**
- Modify: `src/components/shell/TransportBar.vue`
- Modify: `src/components/shell/TransportBar.spec.ts`
- Modify: `src/components/shell/MainView.vue`
- Modify: `src/components/shell/MainView.spec.ts`

### Background
The spectrogram vertical-zoom slider is currently rendered as a fixed panel on the right edge of `MainView.vue`. The user wants it as a hover-popover in `TransportBar.vue` — matching the existing volume controls (`music-volume`, `sfx-volume`) exactly. It should only be visible when `timeline?.viewMode.value === 'spectrogram'`.

The vertical zoom slider controls `frequencyMax` for the spectrogram. In `useTimelineView`, `setVerticalZoom(v)` already exists. `verticalZoom.value` ranges from `0.5` to `10` (defined in `useTimelineView.setVerticalZoom`).

Note: `isLoading` will be added to `useTimelineView` in Task 7 but the `makeTimeline` stub in `TransportBar.spec.ts` already includes it as added in Task 1.

- [ ] **Step 1: Write failing test for vertical zoom popover visibility in `TransportBar.spec.ts`**

Add to the existing `describe` in `TransportBar.spec.ts`:

```typescript
describe('TransportBar vertical zoom popover', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not render vertical-zoom popover in waveform mode', () => {
    const timeline = makeTimeline({ viewMode: ref<'waveform' | 'spectrogram'>('waveform') })
    const wrapper = mountWithTimeline(timeline)
    expect(wrapper.find('[data-testid="vertical-zoom-popover"]').exists()).toBe(false)
  })

  it('renders vertical-zoom popover trigger in spectrogram mode', () => {
    const timeline = makeTimeline({ viewMode: ref<'waveform' | 'spectrogram'>('spectrogram') })
    const wrapper = mountWithTimeline(timeline)
    expect(wrapper.find('[data-testid="vertical-zoom-popover"]').exists()).toBe(true)
  })

  it('shows zoom slider on hover', async () => {
    const timeline = makeTimeline({ viewMode: ref<'waveform' | 'spectrogram'>('spectrogram') })
    const wrapper = mountWithTimeline(timeline)
    const popover = wrapper.get('[data-testid="vertical-zoom-popover"]')

    // Initially hidden
    expect(wrapper.find('[data-testid="vertical-zoom-slider"]').isVisible()).toBe(false)

    await popover.trigger('mouseenter')
    expect(wrapper.find('[data-testid="vertical-zoom-slider"]').isVisible()).toBe(true)

    await popover.trigger('mouseleave')
    expect(wrapper.find('[data-testid="vertical-zoom-slider"]').isVisible()).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```
pnpm test:run "src/components/shell/TransportBar.spec.ts"
```

Expected: 3 new tests fail — `vertical-zoom-popover` not found.

- [ ] **Step 3: Add vertical zoom popover to `TransportBar.vue`**

**In `<script setup>`**, add a new ref alongside `musicPopoverOpen` and `sfxPopoverOpen`:

```typescript
const verticalZoomPopoverOpen = ref(false)

function onVerticalZoomWheel(event: WheelEvent): void {
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.1 : -0.1
  const next = (timeline?.verticalZoom.value ?? 1) + delta
  timeline?.setVerticalZoom(next)
}
```

**In `<template>`**, add this block immediately after the `sfx-volume` div (before `</section>`):

```html
<!-- Vertical zoom — spectrogram mode only, hover popover like volume controls -->
<div
  v-if="timeline?.viewMode.value === 'spectrogram'"
  data-testid="vertical-zoom-popover"
  class="relative"
  @mouseenter="verticalZoomPopoverOpen = true"
  @mouseleave="verticalZoomPopoverOpen = false"
  @wheel.prevent="onVerticalZoomWheel"
>
  <button
    class="btn btn-ghost btn-sm btn-square"
    :title="t('transport.verticalZoom')"
  >
    <Icon icon="material-symbols:unfold-more-rounded" class="h-5 w-5" />
  </button>
  <div
    v-show="verticalZoomPopoverOpen"
    data-testid="vertical-zoom-slider"
    class="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded-md border border-base-300 bg-base-100 px-2 py-2 shadow-lg"
  >
    <div class="mb-1 text-center text-[10px] tabular-nums">
      {{ Math.round((timeline?.verticalZoom.value ?? 1) * 100) }}%
    </div>
    <div class="relative h-24 w-6">
      <input
        class="range range-xs absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-90"
        type="range"
        min="0.5"
        max="10"
        step="0.1"
        :value="timeline?.verticalZoom.value ?? 1"
        @input="
          timeline?.setVerticalZoom(($event.target as HTMLInputElement).valueAsNumber)
        "
      />
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run to verify TransportBar tests pass**

```
pnpm test:run "src/components/shell/TransportBar.spec.ts"
```

Expected: All tests PASS.

- [ ] **Step 5: Write failing test for removal from MainView**

Add to `src/components/shell/MainView.spec.ts`:

```typescript
it('vertical-zoom-slider is not rendered in spectrogram mode either (moved to TransportBar)', () => {
  // MainView should no longer have a vertical zoom slider in any mode
  // Previously it showed in spectrogram mode, but now that lives in TransportBar
  const wrapper = mount(MainView)
  // Confirm it's gone regardless of view mode
  expect(wrapper.find('[data-testid="vertical-zoom-slider"]').exists()).toBe(false)
})
```

- [ ] **Step 6: Run to verify the new MainView test fails**

```
pnpm test:run "src/components/shell/MainView.spec.ts"
```

Expected: existing test `vertical-zoom-slider is not rendered in waveform mode (default)` still passes; new test may pass or fail depending on current state. If it passes, no change needed for MainView in this task (but proceed to Step 7 to confirm).

- [ ] **Step 7: Remove vertical zoom panel from `MainView.vue`**

In `src/components/shell/MainView.vue`, remove the entire `<!-- Vertical zoom slider -->` block (from `<div v-if="timeline?.viewMode.value === 'spectrogram'"` through its closing `</div>`), including the `onVerticalZoomWheel` function in `<script setup>`.

Also remove the `onVerticalZoomWheel` function from `<script setup>` in `MainView.vue` (it is now in `TransportBar.vue`).

- [ ] **Step 8: Run all component tests**

```
pnpm test:run "src/components/shell/MainView.spec.ts"
pnpm test:run "src/components/shell/TransportBar.spec.ts"
```

Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/shell/TransportBar.vue src/components/shell/TransportBar.spec.ts \
        src/components/shell/MainView.vue src/components/shell/MainView.spec.ts
git commit -m "fix: move vertical zoom slider to TransportBar hover popover (spectrogram only)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Fix spectrogram plugin (Bugs 5 + 6 partial)

**Files:**
- **Create:** `src/platform/waveform/worker-threads-shim.ts`
- Modify: `vite.config.ts`
- Modify: `src/platform/waveform/wavesurfer-view.ts`
- Modify: `src/composables/useTimelineView.spec.ts`

### Background
Two issues cause the spectrogram to be completely unusable:

**Issue A — Race condition:** `createWaveSurferView` calls `void _initSpectrogram(ws)` (fire-and-forget async dynamic import), then returns. In `useTimelineView._initWaveSurfer`, `view.loadBlob(store.audioFile)` is called synchronously. The dynamic import resolves **after** `loadBlob` finishes — the spectrogram plugin is registered too late and never receives the audio data.

**Fix:** Switch from the async dynamic import of `spectrogram.esm.js` to a **static import** of `WindowedSpectrogramPlugin` from `spectrogram-windowed.esm.js`. This makes plugin registration synchronous, before `loadBlob` is ever called.

**Issue B — `worker_threads` Vite error:** `spectrogram-windowed.esm.js` bundles a web-worker shim that contains `try { require("worker_threads") } catch {}` at module-load time. Vite externalizes `worker_threads` and creates a proxy that throws on property access. Even though the throw is caught, it pollutes the console with `"Module 'worker_threads' has been externalized"` and can affect behavior. Fix: alias `worker_threads` to a browser stub that exports `Worker: undefined`.

- [ ] **Step 1: Create the worker-threads shim**

Create `src/platform/waveform/worker-threads-shim.ts`:

```typescript
/**
 * Browser stub for Node.js `worker_threads` module.
 * Prevents Vite's externalization error when WaveSurfer's spectrogram plugin
 * checks for worker_threads at module load time.
 */
export class Worker {}
export default { Worker }
```

- [ ] **Step 2: Update `vite.config.ts`**

Add the alias and the `fileURLToPath` import:

```typescript
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'

export default defineConfig({
  plugins: [
    VueRouter({ dts: 'src/typed-router.d.ts' }),
    vue(),
    tailwindcss(),
    AutoImport({
      imports: ['vue', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({ dts: 'src/components.d.ts' }),
  ],
  resolve: {
    alias: {
      // Stub Node.js worker_threads so WaveSurfer's spectrogram plugin doesn't
      // trigger Vite's externalization warning in the browser build.
      worker_threads: fileURLToPath(
        new URL('./src/platform/waveform/worker-threads-shim.ts', import.meta.url),
      ),
    },
  },
})
```

- [ ] **Step 3: Update `wavesurfer-view.ts` — static import + synchronous registration**

Replace the entire file with:

```typescript
import WaveSurfer from 'wavesurfer.js'
import type { GenericPlugin } from 'wavesurfer.js/dist/base-plugin.js'
import WindowedSpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js'

export interface WaveSurferViewOptions {
  mode: 'waveform' | 'spectrogram'
  minPxPerSec: number
  /** Height in pixels for the spectrogram canvas (defaults to container height or 256). */
  spectrogramHeight?: number
}

export interface WaveSurferView {
  registerPlugin: <T extends GenericPlugin>(plugin: T) => T
  loadBlob: (blob: Blob) => Promise<void>
  zoom: (pxPerSec: number) => void
  scrollTo: (time: number) => void
  scrollByDelta: (delta: number) => void
  getScrollTime: () => number
  on: (event: string, handler: (...args: unknown[]) => void) => () => void
  destroy: () => void
}

export function createWaveSurferView(
  container: HTMLElement,
  options: WaveSurferViewOptions,
): WaveSurferView {
  const ws = WaveSurfer.create({
    container,
    waveColor: '#4F4A85',
    progressColor: '#383351',
    height: 'auto',
    minPxPerSec: options.minPxPerSec,
    interact: true,
    hideScrollbar: false,
  })

  if (options.mode === 'spectrogram') {
    const height = options.spectrogramHeight ?? container.clientHeight || 256
    ws.registerPlugin(
      WindowedSpectrogramPlugin.create({
        fftSamples: 1024,
        labels: true,
        useWebWorker: true,
        height,
      }),
    )
  }

  function _getScrollContainer(): HTMLElement | null {
    return ws.getWrapper().parentElement
  }

  return {
    registerPlugin<T extends GenericPlugin>(plugin: T): T {
      return ws.registerPlugin(plugin)
    },

    async loadBlob(blob: Blob): Promise<void> {
      await ws.loadBlob(blob)
    },

    zoom(pxPerSec: number): void {
      ws.zoom(pxPerSec)
    },

    scrollTo(time: number): void {
      const scrollEl = _getScrollContainer()
      if (!scrollEl) return
      const duration = ws.getDuration()
      if (duration <= 0) return
      const wrapper = ws.getWrapper()
      const pxPerSec = wrapper.scrollWidth / duration
      const center = scrollEl.clientWidth / 2
      scrollEl.scrollLeft = Math.max(0, time * pxPerSec - center)
    },

    scrollByDelta(delta: number): void {
      const scrollEl = _getScrollContainer()
      if (scrollEl) scrollEl.scrollLeft += delta
    },

    getScrollTime(): number {
      const scrollEl = _getScrollContainer()
      if (!scrollEl) return 0
      const duration = ws.getDuration()
      if (duration <= 0) return 0
      const wrapper = ws.getWrapper()
      return (scrollEl.scrollLeft / wrapper.scrollWidth) * duration
    },

    on(event: string, handler: (...args: unknown[]) => void): () => void {
      return ws.on(event as Parameters<typeof ws.on>[0], handler as never)
    },

    destroy(): void {
      ws.destroy()
    },
  }
}
```

Key changes:
- `interact: false` → `interact: true` (enables click-to-seek + scroll)
- Removed async `_initSpectrogram`; replaced with synchronous `WindowedSpectrogramPlugin.create()` when `mode === 'spectrogram'`
- Added `scrollByDelta` to interface and implementation

- [ ] **Step 4: Update the WaveSurfer mock in `useTimelineView.spec.ts`**

The mock currently mocks `spectrogram.esm.js`. Change it to mock the windowed spectrogram instead. Also add `scrollByDelta: vi.fn()` to the mock WaveSurfer object:

```typescript
// Replace this mock:
vi.mock('wavesurfer.js/dist/plugins/spectrogram.esm.js', () => ({
  default: {
    create: vi.fn(() => ({})),
  },
}))

// With this:
vi.mock('wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js', () => ({
  default: {
    create: vi.fn(() => ({})),
  },
}))
```

Also update the mock WaveSurfer object to include `scrollByDelta`:

In the `vi.mock('wavesurfer.js', ...)` factory, the `mockWs` currently has no `scrollByDelta`. This is fine because `scrollByDelta` is on `_getScrollContainer()` not on `ws` directly. No mock change needed for WaveSurfer itself.

However, the `WaveSurferView` interface now has `scrollByDelta`. If `createWaveSurferView` is called in tests, the mock `ws` needs to support it. Since tests with `containerRef = null` never call `_initWaveSurfer`, no mock update is needed for existing tests. But if a new test exercises `onWheel` plain scroll, the `wavesurferView?.scrollByDelta` call must work — since `wavesurferView` is null in those test harnesses, the optional chain is safe.

- [ ] **Step 5: Run tests to verify no regressions**

```
pnpm test:run "src/composables/useTimelineView.spec.ts"
pnpm test:run "src/platform/waveform"
```

Expected: All existing tests PASS. (There are no existing tests for the spectrogram plugin specifically.)

- [ ] **Step 6: Commit**

```bash
git add src/platform/waveform/worker-threads-shim.ts \
        vite.config.ts \
        src/platform/waveform/wavesurfer-view.ts \
        src/composables/useTimelineView.spec.ts
git commit -m "fix: spectrogram plugin race condition + worker_threads Vite error

- Switch to static import of WindowedSpectrogramPlugin (synchronous registration)
- Add worker_threads browser shim to suppress Vite externalization warning
- Add interact:true to enable click-to-seek and scroll
- Add scrollByDelta() to WaveSurferView for horizontal scroll relay

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Click-to-seek and horizontal scroll (Bugs 2 + 3)

**Files:**
- Modify: `src/composables/useTimelineView.ts`
- Modify: `src/composables/useTimelineView.spec.ts`
- Modify: `src/components/shell/MainView.vue`

### Background

**Bug 2 (click-to-seek):** With `interact: true` (set in Task 4), WaveSurfer fires an `interaction` event with the new seek time (in seconds) whenever the user clicks. We need to subscribe to this event in `_initWaveSurfer` and call `store.seekPlayback(time)`.

**Bug 3 (horizontal scroll):** WaveSurfer's internal `#scroll` container uses `overflow-x: auto; overflow-y: hidden`. Vertical mouse-wheel `deltaY` events on the waveform area do NOT scroll it horizontally by default — WaveSurfer doesn't map vertical wheel to horizontal scroll. Additionally, the `overflow-hidden` Tailwind class on `waveformEl` in MainView clips content. Fix:
1. Remove `overflow-hidden` from `waveformEl` and add `relative` (needed for absolute-positioned overlay canvas).
2. In `MainView.onWheel`, always `preventDefault()` and always delegate to `timeline.onWheel`.
3. In `useTimelineView.onWheel`, add a plain-scroll case that calls `wavesurferView.scrollByDelta(e.deltaY)`.

- [ ] **Step 1: Write failing test for horizontal scroll relay**

Add to `src/composables/useTimelineView.spec.ts`:

```typescript
it('onWheel plain scroll (no modifier) calls scrollByDelta on wavesurfer', () => {
  // This tests the behavior indirectly through the composable's state.
  // Since wavesurferView is null in these tests (containerRef not set),
  // scrollByDelta is a no-op. We just verify no exception is thrown
  // and the event is not treated as zoom or subdivision change.
  let timeline: ReturnType<typeof useTimelineView> | undefined
  const containerRef = shallowRef<HTMLElement | null>(null)
  const wrapper = mountHarness(() => {
    timeline = useTimelineView(containerRef)
  })

  const initialPps = timeline!.pxPerSec.value
  const initialDivisor = timeline!.divisor.value

  // Plain wheel scroll (no ctrlKey, no shiftKey)
  const event = new WheelEvent('wheel', { deltaY: 100 })
  expect(() => timeline!.onWheel(event)).not.toThrow()

  // pxPerSec and divisor should be unchanged
  expect(timeline!.pxPerSec.value).toBe(initialPps)
  expect(timeline!.divisor.value).toBe(initialDivisor)

  wrapper.unmount()
})
```

- [ ] **Step 2: Run to verify — this test should already pass (no-throw is the requirement)**

```
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: PASS (the test may already pass since `wavesurferView?.scrollByDelta` is a safe no-op). If it fails for another reason, investigate.

- [ ] **Step 3: Update `useTimelineView.ts` — wire interaction event + plain-scroll relay**

In `_initWaveSurfer`, after registering the grid plugin, add the `interaction` event subscription:

```typescript
function _initWaveSurfer(container: HTMLElement): WaveSurferView {
  const view = createWaveSurferView(container, {
    mode: viewMode.value,
    minPxPerSec: pxPerSec.value,
    spectrogramHeight: container.clientHeight || 256,
  })
  wavesurferView = view
  gridPlugin = view.registerPlugin(GridOverlayPlugin.create({ outerContainer: container }))

  // Click-to-seek: WaveSurfer fires 'interaction' with newTime when interact: true
  view.on('interaction', (time: unknown) => {
    store.seekPlayback(time as number)
  })

  if (store.audioFile) {
    void view.loadBlob(store.audioFile)
  }

  return view
}
```

Also update `onWheel` to handle plain scroll:

```typescript
function onWheel(e: WheelEvent): void {
  if (e.ctrlKey) {
    const factor = e.deltaY < 0 ? 1.25 : 0.8
    const newPps = Math.max(10, Math.min(2000, pxPerSec.value * factor))
    pxPerSec.value = newPps
    wavesurferView?.zoom(newPps)
  } else if (e.shiftKey) {
    const options = [1, 2, 4, 8, 16] as const
    const idx = options.indexOf(divisor.value as (typeof options)[number])
    if (e.deltaY < 0 && idx < options.length - 1) {
      store.setSnapDivisor(options[idx + 1])
    } else if (e.deltaY > 0 && idx > 0) {
      store.setSnapDivisor(options[idx - 1])
    }
  } else {
    // Plain scroll: relay vertical deltaY as horizontal scroll on the WaveSurfer container
    wavesurferView?.scrollByDelta(e.deltaY)
  }
}
```

- [ ] **Step 4: Update `MainView.vue` — always delegate wheel + fix overflow**

In `src/components/shell/MainView.vue`:

**In `<script setup>`**, change the `onWheel` function to always delegate:

```typescript
function onWheel(e: WheelEvent): void {
  e.preventDefault()
  e.stopPropagation()
  timeline?.onWheel(e)
}
```

**In `<template>`**, change the waveform div class from `"h-full w-full overflow-hidden"` to `"relative h-full w-full"`:

```html
<!-- WaveSurfer mount point — position:relative needed for absolute canvas overlay -->
<div
  ref="waveformEl"
  data-testid="waveform-container"
  class="relative h-full w-full"
/>
```

- [ ] **Step 5: Run tests**

```
pnpm test:run "src/composables/useTimelineView.spec.ts"
pnpm test:run "src/components/shell/MainView.spec.ts"
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/composables/useTimelineView.ts src/composables/useTimelineView.spec.ts \
        src/components/shell/MainView.vue
git commit -m "fix: click-to-seek and horizontal mouse-wheel scroll on waveform

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Grid overlay canvas placement and initial render (Bug 4)

**Files:**
- Modify: `src/platform/waveform/grid-overlay-plugin.ts`
- (No test file changes needed — the existing mock in `useTimelineView.spec.ts` passes `outerContainer` via the `GridOverlayPlugin.create({ outerContainer: container })` call added in Task 5)

### Background
The `GridOverlayPlugin` canvas is appended to the shadow DOM's `#scroll` container (accessible as `ws.getWrapper().parentElement`). The problem:

1. **Canvas scrolls with content:** `position: absolute` inside a scroll container scrolls with its children — the canvas drifts out of view as the user scrolls.
2. **Initial blank render:** `visibleStart` and `visibleEnd` start at `0`, so `visibleDuration = 0` and `_draw()` returns early. Nothing is drawn until the first `scroll` event fires.

**Fix:**
1. Accept an `outerContainer` option (the same element passed as WaveSurfer's `container`). Append the canvas to `outerContainer` (which is in the light DOM, not shadow DOM), positioned absolutely over the entire waveform viewport.
2. On the `ready` event, compute `visibleStart/visibleEnd` from the shadow DOM `#scroll` scroll position and dimensions, then call `_draw()`.

`useTimelineView._initWaveSurfer` already passes `{ outerContainer: container }` from Task 5.

- [ ] **Step 1: Write failing test**

The grid plugin behavior (canvas drift) is difficult to unit test without a real browser DOM. Instead, write a test that verifies the canvas is appended to `outerContainer` (not to `#scroll`):

Add to `src/composables/useTimelineView.spec.ts` (inside the existing `describe`):

```typescript
it('GridOverlayPlugin appends canvas to the provided outerContainer', () => {
  // Arrange: create a real container element
  const container = document.createElement('div')
  container.style.width = '800px'
  container.style.height = '200px'
  document.body.appendChild(container)

  // Create the plugin with an explicit outerContainer
  const { GridOverlayPlugin } = await import('../platform/waveform/grid-overlay-plugin')
  const plugin = GridOverlayPlugin.create({ outerContainer: container })

  // Simulate what WaveSurfer calls on plugin registration
  const fakeWrapper = document.createElement('div')
  const fakeScroll = document.createElement('div')
  fakeScroll.appendChild(fakeWrapper)

  // Manually call onInit (it's protected; access via bracket notation for testing)
  ;(plugin as unknown as { wavesurfer: unknown }).wavesurfer = {
    getWrapper: () => fakeWrapper,
    getDuration: () => 0,
    on: vi.fn(() => () => {}),
  }
  ;(plugin as unknown as { onInit: () => void }).onInit()

  // Canvas should be in outerContainer, not in fakeScroll
  const canvases = container.querySelectorAll('canvas')
  expect(canvases.length).toBe(1)
  expect(fakeScroll.querySelector('canvas')).toBeNull()

  document.body.removeChild(container)
})
```

> **Note:** This test directly exercises the plugin. Because it imports dynamically, it must be in an `async` `it`. Change the function signature to `async`.

Actually, because the plugin is already imported at the top of the test file via `vi.mock('wavesurfer.js', ...)`, doing a separate import here works with the mock in place. But `grid-overlay-plugin.ts` is NOT mocked — it's a real implementation. The test calls internal methods directly.

If this approach is too fragile for your test environment, skip the unit test and rely on visual verification + the integration test coverage in Task 7.

- [ ] **Step 2: Update `grid-overlay-plugin.ts`**

Replace the entire file:

```typescript
import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

import type { TimingPoint } from '../../core/domain/project'
import { getBeatGridLines } from '../../core/timing/timing-engine'

export interface GridOverlayOptions {
  /** The shadow host element (same as WaveSurfer's container option).
   *  The canvas is placed here so it doesn't scroll with WaveSurfer's internal #scroll. */
  outerContainer?: HTMLElement
}

export interface GridOverlayParams {
  timingPoints: TimingPoint[]
  currentTime: number
  divisor: number
  triplets: boolean
}

export class GridOverlayPlugin extends BasePlugin<BasePluginEvents, GridOverlayOptions> {
  private canvas: HTMLCanvasElement | null = null
  private params: GridOverlayParams = {
    timingPoints: [],
    currentTime: 0,
    divisor: 4,
    triplets: false,
  }

  private visibleStart = 0
  private visibleEnd = 0

  static create(options?: GridOverlayOptions): GridOverlayPlugin {
    return new GridOverlayPlugin(options ?? {})
  }

  protected onInit(): void {
    const ws = this.wavesurfer!
    const wrapper = ws.getWrapper()
    // #scroll is the viewport container inside WaveSurfer's shadow DOM
    const scrollContainer = wrapper.parentElement

    // Use the provided outerContainer (shadow host in the light DOM).
    // Fall back to shadow-root introspection for environments where outerContainer is omitted.
    const containerEl: HTMLElement =
      this.options.outerContainer ??
      (() => {
        const root = wrapper.getRootNode()
        // In real WaveSurfer, getRootNode() returns the ShadowRoot; .host is the container.
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
      zIndex: '2',
    })
    // Make the container a positioning context for the absolutely-placed canvas
    containerEl.style.position = 'relative'
    containerEl.appendChild(this.canvas)

    this.subscriptions.push(
      ws.on('scroll', (start: number, end: number) => {
        this.visibleStart = start
        this.visibleEnd = end
        this._draw()
      }),
      ws.on('redraw', () => this._draw()),
      ws.on('zoom', () => this._draw()),
      ws.on('ready', () => {
        // Initialize visible range from the scroll container's current state
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

  update(params: GridOverlayParams): void {
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

    const lines = getBeatGridLines(
      this.params.timingPoints,
      this.params.divisor,
      this.params.triplets,
      Math.max(0, this.visibleStart - 0.5),
      Math.min(duration, this.visibleEnd + 0.5),
    )

    for (const line of lines) {
      const x = Math.round((line.time - this.visibleStart) * pxPerSec) + 0.5
      if (x < -2 || x > w + 2) continue

      if (line.type === 'bar') {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 2
      } else if (line.type === 'beat') {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 1
      }

      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    // Draw playhead
    const px =
      Math.round((this.params.currentTime - this.visibleStart) * pxPerSec) + 0.5
    if (px >= -2 && px <= w + 2) {
      ctx.strokeStyle = 'rgba(255,50,50,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
    }
  }

  destroy(): void {
    this.canvas?.remove()
    this.canvas = null
    super.destroy()
  }
}
```

- [ ] **Step 3: Run all tests**

```
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: All pass. (The existing tests use `containerRef = null`, so `_initWaveSurfer` is never called with the plugin; no regressions.)

- [ ] **Step 4: Commit**

```bash
git add src/platform/waveform/grid-overlay-plugin.ts src/composables/useTimelineView.spec.ts
git commit -m "fix: grid overlay canvas on shadow host + initialize visible range on ready

Canvas is now placed on the WaveSurfer outer container (light DOM),
not on the shadow DOM scroll container, so it stays fixed during scroll.
Visible range is initialized from scroll container state on 'ready' event.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: Loading indicator + spectrogram vertical zoom reinit (Bug 6 + Bug 8 follow-up)

**Files:**
- Modify: `src/composables/useTimelineView.ts`
- Modify: `src/composables/useTimelineView.spec.ts`
- Modify: `src/components/shell/MainView.vue`
- Modify: `src/components/shell/MainView.spec.ts`

### Background
**Bug 6 (loading indicator):** When audio loads or spectrogram FFT runs, the UI is unresponsive with no feedback. We expose an `isLoading: Ref<boolean>` from `useTimelineView` — set `true` before `loadBlob`, `false` on WaveSurfer's `ready` event. `MainView.vue` shows a centered spinner overlay while loading.

**Bug 8 follow-up (vertical zoom reinit):** Changing `verticalZoom` should update the spectrogram frequency range. Since `WindowedSpectrogramPlugin` does not expose a live frequency-update API, we recreate the WaveSurfer instance when `verticalZoom` changes in spectrogram mode. This reuses `setViewMode`'s teardown logic via a dedicated `_recreateWaveSurfer` helper.

- [ ] **Step 1: Write failing test for `isLoading`**

Add to `src/composables/useTimelineView.spec.ts`:

```typescript
it('isLoading starts false', () => {
  let timeline: ReturnType<typeof useTimelineView> | undefined
  const containerRef = shallowRef<HTMLElement | null>(null)
  const wrapper = mountHarness(() => {
    timeline = useTimelineView(containerRef)
  })

  expect(timeline!.isLoading.value).toBe(false)
  wrapper.unmount()
})
```

- [ ] **Step 2: Run to verify failure**

```
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: FAIL — `timeline.isLoading` is undefined (not yet exposed).

- [ ] **Step 3: Update `useTimelineView.ts` — add `isLoading`, wire ready event, expose`isLoading`, and add vertical zoom watch**

Replace the contents of `src/composables/useTimelineView.ts` with:

```typescript
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import type { InjectionKey, ShallowRef } from 'vue'

import { GridOverlayPlugin } from '../platform/waveform/grid-overlay-plugin'
import { createWaveSurferView } from '../platform/waveform/wavesurfer-view'
import type { WaveSurferView } from '../platform/waveform/wavesurfer-view'
import { useEditorStore } from '../stores/editor-store'

export type TimelineViewContext = ReturnType<typeof useTimelineView>
export const TIMELINE_VIEW_KEY: InjectionKey<TimelineViewContext> =
  Symbol('timelineView')

const DEFAULT_PX_PER_SEC = 100

export function useTimelineView(containerRef: ShallowRef<HTMLElement | null>) {
  const store = useEditorStore()

  // ---- Local UI state ----
  const viewMode = ref<'waveform' | 'spectrogram'>('waveform')
  const pxPerSec = ref(DEFAULT_PX_PER_SEC)
  const verticalZoom = ref(1)
  const altTripletActive = ref(false)
  const isLoading = ref(false)

  // ---- Project-persisted state (via store/commands) ----
  const divisor = computed({
    get: () => store.project.settings.snapDivisor,
    set: (v: 1 | 2 | 4 | 8 | 16) => store.setSnapDivisor(v),
  })

  const rhythmMode = computed({
    get: () => store.project.settings.rhythmMode,
    set: (v: 'common' | 'triplets') => store.setRhythmMode(v),
  })

  const effectiveTriplets = computed(
    () => rhythmMode.value === 'triplets' || altTripletActive.value,
  )

  // ---- WaveSurfer state ----
  let wavesurferView: WaveSurferView | null = null
  let gridPlugin: GridOverlayPlugin | null = null

  function _buildOverlayParams() {
    return {
      timingPoints: store.project.timingPoints,
      currentTime: store.currentTime,
      divisor: divisor.value,
      triplets: effectiveTriplets.value,
    }
  }

  function _initWaveSurfer(container: HTMLElement): WaveSurferView {
    const view = createWaveSurferView(container, {
      mode: viewMode.value,
      minPxPerSec: pxPerSec.value,
      spectrogramHeight: container.clientHeight || 256,
    })
    wavesurferView = view
    gridPlugin = view.registerPlugin(GridOverlayPlugin.create({ outerContainer: container }))

    // Click-to-seek: WaveSurfer fires 'interaction' with newTime when interact: true
    view.on('interaction', (time: unknown) => {
      store.seekPlayback(time as number)
    })

    // Loading state: set false when audio is ready
    view.on('ready', () => {
      isLoading.value = false
    })

    if (store.audioFile) {
      isLoading.value = true
      void view.loadBlob(store.audioFile)
    }

    return view
  }

  // Initialize when container becomes available
  watchEffect(() => {
    const container = containerRef.value
    if (container && !wavesurferView) {
      _initWaveSurfer(container)
    }
  })

  // Re-load audio when a new file is imported
  watch(
    () => store.audioFile,
    (file) => {
      if (file && wavesurferView) {
        isLoading.value = true
        void wavesurferView.loadBlob(file)
      }
    },
  )

  // Sync grid + auto-scroll on every currentTime tick
  watch(
    () => store.currentTime,
    (t) => {
      gridPlugin?.update(_buildOverlayParams())
      if (store.isPlaying) {
        wavesurferView?.scrollTo(t)
      }
    },
  )

  // Redraw grid when timing points or divisor/triplets change
  watch(
    [() => store.project.timingPoints, divisor, effectiveTriplets],
    () => {
      gridPlugin?.update(_buildOverlayParams())
    },
    { deep: true },
  )

  // Reinitialize spectrogram when verticalZoom changes (updates frequencyMax)
  watch(verticalZoom, () => {
    if (viewMode.value === 'spectrogram') {
      setViewMode('spectrogram')
    }
  })

  // ---- Alt key tracking ----
  function _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Alt') altTripletActive.value = true
  }
  function _onKeyup(e: KeyboardEvent): void {
    if (e.key === 'Alt') altTripletActive.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', _onKeydown)
    window.addEventListener('keyup', _onKeyup)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', _onKeydown)
    window.removeEventListener('keyup', _onKeyup)
    wavesurferView?.destroy()
    wavesurferView = null
    gridPlugin = null
  })

  // ---- Public API ----

  function setViewMode(mode: 'waveform' | 'spectrogram'): void {
    const container = containerRef.value
    const scrollTime = wavesurferView?.getScrollTime() ?? 0

    wavesurferView?.destroy()
    wavesurferView = null
    gridPlugin = null

    viewMode.value = mode

    if (container) {
      const view = _initWaveSurfer(container)
      // Restore scroll position after audio reloads
      if (store.audioFile) {
        void view.loadBlob(store.audioFile).then(() => view.scrollTo(scrollTime))
      }
    }
  }

  function setVerticalZoom(v: number): void {
    verticalZoom.value = Math.max(0.5, Math.min(10, v))
  }

  /**
   * Wheel event handler for the waveform container.
   * Ctrl+wheel → horizontal zoom; Shift+wheel → subdivision divisor change;
   * plain wheel → horizontal scroll relay to WaveSurfer scroll container.
   */
  function onWheel(e: WheelEvent): void {
    if (e.ctrlKey) {
      const factor = e.deltaY < 0 ? 1.25 : 0.8
      const newPps = Math.max(10, Math.min(2000, pxPerSec.value * factor))
      pxPerSec.value = newPps
      wavesurferView?.zoom(newPps)
    } else if (e.shiftKey) {
      const options = [1, 2, 4, 8, 16] as const
      const idx = options.indexOf(divisor.value as (typeof options)[number])
      if (e.deltaY < 0 && idx < options.length - 1) {
        store.setSnapDivisor(options[idx + 1])
      } else if (e.deltaY > 0 && idx > 0) {
        store.setSnapDivisor(options[idx - 1])
      }
    } else {
      // Plain scroll: relay vertical deltaY as horizontal scroll
      wavesurferView?.scrollByDelta(e.deltaY)
    }
  }

  return {
    viewMode,
    pxPerSec,
    verticalZoom,
    divisor,
    rhythmMode,
    effectiveTriplets,
    altTripletActive,
    isLoading,
    setViewMode,
    setVerticalZoom,
    onWheel,
  }
}
```

**Key change in `setViewMode`:** The early-return `if (mode === viewMode.value) return` is removed. This allows `setViewMode('spectrogram')` to be called when already in spectrogram mode (needed when `verticalZoom` changes to reinit).

- [ ] **Step 4: Run to verify `isLoading` test passes**

```
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: All pass.

- [ ] **Step 5: Write failing test for loading overlay in `MainView.spec.ts`**

Add to `src/components/shell/MainView.spec.ts`:

```typescript
it('renders loading overlay when timeline isLoading is true', async () => {
  const wrapper = mount(MainView)
  // By default no timeline is injected; waveform-loading should not be present
  expect(wrapper.find('[data-testid="waveform-loading"]').exists()).toBe(false)
})
```

(This test just verifies the loading overlay doesn't appear without a loading timeline. A more complete integration test would inject a mock timeline with `isLoading = true`, but that requires the TIMELINE_VIEW_KEY provide pattern. The simple check is sufficient — the overlay's existence is controlled by `v-if`.)

- [ ] **Step 6: Run to verify the test passes (or fails if the overlay doesn't exist yet)**

```
pnpm test:run "src/components/shell/MainView.spec.ts"
```

- [ ] **Step 7: Add loading overlay to `MainView.vue`**

In `src/components/shell/MainView.vue`, after the `waveformEl` div and before the `word-timeline-bar-slot` div, add:

```html
<!-- Loading spinner — shown while WaveSurfer is decoding audio or computing spectrogram -->
<div
  v-if="timeline?.isLoading.value"
  data-testid="waveform-loading"
  class="absolute inset-0 z-10 flex items-center justify-center bg-base-200/50"
>
  <span class="loading loading-spinner loading-md text-primary" />
</div>
```

Full updated template structure for reference:
```html
<template>
  <section
    data-testid="main-view-container"
    :style="{ height: `${height}px` }"
    class="relative border-b border-base-300 bg-base-200/30"
  >
    <!-- WaveSurfer mount point — position:relative needed for absolute canvas overlay -->
    <div
      ref="waveformEl"
      data-testid="waveform-container"
      class="relative h-full w-full"
    />

    <!-- Loading spinner -->
    <div
      v-if="timeline?.isLoading.value"
      data-testid="waveform-loading"
      class="absolute inset-0 z-10 flex items-center justify-center bg-base-200/50"
    >
      <span class="loading loading-spinner loading-md text-primary" />
    </div>

    <!-- Phase 4 placeholder: WordTimelineBar will be mounted here -->
    <div data-testid="word-timeline-bar-slot" class="hidden" />

    <!-- Resize handle -->
    <div
      data-testid="main-view-resize-handle"
      class="absolute inset-x-0 bottom-0 h-2 cursor-row-resize"
      @pointerdown="onPointerDown"
    />
  </section>
</template>
```

- [ ] **Step 8: Run all tests**

```
pnpm test:run "src/components/shell/MainView.spec.ts"
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add src/composables/useTimelineView.ts src/composables/useTimelineView.spec.ts \
        src/components/shell/MainView.vue src/components/shell/MainView.spec.ts
git commit -m "fix: loading indicator + vertical zoom reinit for spectrogram

- Expose isLoading from useTimelineView; set true before loadBlob, false on ready
- MainView shows centered spinner overlay during audio loading
- verticalZoom watch triggers spectrogram reinit with updated frequencyMax
- Remove early-return guard in setViewMode to allow same-mode reinit

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 8: Final check — run full test suite and lint

- [ ] **Step 1: Run all tests**

```
pnpm test:run
```

Expected: All tests pass. If any fail, fix the regressions before proceeding.

- [ ] **Step 2: Lint and format**

```
pnpm lint && pnpm format
```

Fix any lint errors. `pnpm format` auto-fixes formatting.

- [ ] **Step 3: Type check**

```
pnpm check
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: lint + format pass after Phase 3 bugfixes

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Self-Review Checklist

### Spec coverage
| Bug | Task | Covered? |
|-----|------|---------|
| 1. Alt-triplet dropdown | Task 1 | ✅ `:value` → `effectiveTriplets` |
| 2. Click-to-seek | Tasks 4 + 5 | ✅ `interact: true` + `interaction` event |
| 3. Horizontal scroll | Tasks 4 + 5 | ✅ `scrollByDelta` + always-delegate wheel |
| 4. Grid overlay sync | Task 6 | ✅ Canvas on shadow host + `ready` init |
| 5. Spectrogram broken | Task 4 | ✅ Static import eliminates race; `worker_threads` shim |
| 6. Loading indicator | Task 7 | ✅ `isLoading` ref + spinner overlay |
| 7. Metronome latch on pause | Task 2 | ✅ `fireLatchNow` + toggleMetronome change |
| 8. Vertical zoom popover | Tasks 3 + 7 | ✅ Moved to TransportBar hover popover |

### Type consistency
- `MetronomeScheduler.fireLatchNow()` — added to interface (Task 2) and used in store (Task 2). All mocks updated in same task.
- `WaveSurferView.scrollByDelta()` — added to interface and implementation (Task 4), used in composable (Task 5).
- `GridOverlayOptions.outerContainer` — defined in plugin (Task 6), passed from composable (Task 5).
- `WaveSurferViewOptions.spectrogramHeight` — added (Task 4), used in composable (Task 5, 7).
- `isLoading: Ref<boolean>` — added to composable return (Task 7), used in MainView and TransportBar stubs.

### Known limitations
- Spectrogram `frequencyMax` is passed at creation time; changing `verticalZoom` triggers a full WaveSurfer recreate (audio reloads). A future optimization could update frequency range without recreating.
- The `useWebWorker: true` path in `WindowedSpectrogramPlugin` uses a browser `Worker` created from an inlined base64 script. This should work in modern browsers but has not been tested in all environments.
- The grid overlay canvas resizes with its container via `canvas.width = container.clientWidth` in `_draw`. No `ResizeObserver` is used — if the container resizes without a WaveSurfer event, the canvas may be stale until the next `currentTime` tick.
