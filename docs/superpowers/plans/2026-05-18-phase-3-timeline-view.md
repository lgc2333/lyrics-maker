# Phase 3: Main Timeline View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase 3 main timeline view: wavesurfer.js waveform/spectrogram rendering, beat-grid overlay plugin, subdivision-level seeking, waveform/spectrogram toggle, vertical zoom slider, and related shortcuts.

**Architecture:** WaveSurfer renders waveform or spectrogram in `MainView`; a custom `GridOverlayPlugin` (extends WaveSurfer `BasePlugin`) draws beat/bar/subdivision lines and playhead on a canvas overlay inside WaveSurfer's scroll container. A `useTimelineView` composable owns the WaveSurfer lifecycle and is created in `AppShell`, provided down to `MainView` and `TransportBar` via Vue's `provide/inject`.

**Tech Stack:** `wavesurfer.js` (waveform + SpectrogramPlugin), Vue 3 Composition API, Pinia, TypeScript, DaisyUI/Tailwind for controls.

---

## Key Architecture Rules (read before touching any file)

- **Codebase root:** `d:\Coding\lyrics-maker\`
- **Package manager:** `pnpm` — use `pnpm add`, never `npm install`
- **Run commands via:** `pnpm exec` / `pnpm dlx`, not `npx`
- **Test runner:** `pnpm test:run` (all), `pnpm test:run "<path>"` (single file)
- **Lint/format:** always run `pnpm lint && pnpm format` before committing
- **`shallowRef` + `triggerRef`:** Platform objects are held in `shallowRef`. After async mutations that change internal state, call `triggerRef(ref)` to wake computed properties.
- **Reactive updates before `await`:** Put `ref.value = x` assignments BEFORE the first `await` in async functions.
- **`Math.round`** for ms↔seconds conversion, never `Math.floor`.
- **No direct data mutation from UI.** All project state changes go through `store.execute(command)`.
- **`core/` and `platform/` are Vue-free.** No Vue imports in those directories.
- **`@iconify/vue`** is globally mocked in `src/test/setup.ts` — do not add per-test mocks.
- **`useEditorShortcuts` dispatches async:** After firing a key event in tests, use `await vi.waitFor(() => expect(...))`, not a synchronous check.
- **Store DI pattern:** Override factories before `setActivePinia(createPinia())` in tests:
  ```ts
  __overrideAudioTransportFactory(() => mockAudioTransport)
  __overrideMetronomeFactory(() => mockMetronome)
  setActivePinia(createPinia())
  ```

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/platform/waveform/grid-overlay-plugin.ts` | WaveSurfer `BasePlugin` — viewport-canvas grid/playhead overlay |
| `src/platform/waveform/wavesurfer-view.ts` | Factory wrapper around WaveSurfer instance lifecycle |
| `src/composables/useTimelineView.ts` | Vue composable — orchestrates WaveSurfer, grid, scroll, zoom, Alt-triplet |

### Modified files
| File | What changes |
|------|-------------|
| `src/core/domain/project.ts` | `snapDivisor: 1\|2\|4\|8\|16`, add `rhythmMode: 'common'\|'triplets'` |
| `src/core/timing/timing-engine.ts` | Add `GridLine`, `getBeatGridLines`, `getNextSubdivisionTime`, `getPreviousSubdivisionTime` |
| `src/core/timing/timing-engine.spec.ts` | Tests for the three new exports |
| `src/core/commands/project-commands.ts` | Add `createSetRhythmModeCommand`, `createSetSnapDivisorCommand` |
| `src/core/commands/project-commands.spec.ts` | Tests for the two new commands |
| `src/platform/shortcuts/registry.ts` | 4 new `ShortcutAction` members |
| `src/composables/useEditorShortcuts.ts` | Register 4 new shortcuts |
| `src/stores/editor-store.ts` | Add `audioFile`, `seekToNextBeat`, `seekToPrevBeat`, `setRhythmMode`, `setSnapDivisor` |
| `src/components/shell/MainView.vue` | Replace placeholder with WaveSurfer container + vertical zoom slider |
| `src/components/shell/TransportBar.vue` | Add waveform/spectrogram toggle, subdivision dropdown, rhythm mode dropdown |
| `src/components/shell/AppShell.vue` | Create `useTimelineView`, provide it and `timelineContainerRef`, wire new shortcuts |
| `src/platform/i18n/locales/zh-CN.json` | New translation keys |

---

## Task 1: Install wavesurfer.js

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install package**

  ```
  cd d:\Coding\lyrics-maker
  pnpm add wavesurfer.js
  ```

- [ ] **Step 2: Verify import resolves**

  Create a temporary file `src/platform/waveform/_check.ts`:
  ```ts
  import WaveSurfer from 'wavesurfer.js'
  export type _ = typeof WaveSurfer
  ```
  Run `pnpm check` — expect no errors. Then delete `src/platform/waveform/_check.ts`.

- [ ] **Step 3: Check spectrogram plugin import path**

  Run this to find the spectrogram plugin export:
  ```
  node -e "const m = require('d:/Coding/lyrics-maker/node_modules/wavesurfer.js/dist/plugins/spectrogram.js'); console.log(Object.keys(m))"
  ```
  Expected output contains `default`. Note the path for Task 9.

- [ ] **Step 4: Commit**

  ```
  git add package.json pnpm-lock.yaml
  git commit -m "chore: install wavesurfer.js

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 2: Extend data model (ProjectSettings)

**Files:**
- Modify: `src/core/domain/project.ts`
- Modify: `src/core/domain/project.spec.ts`

### Background
`ProjectSettings` currently has `snapDivisor: 4 | 8 | 16`. Phase 3 extends the subdivision granularity to include 1x and 2x, and adds `rhythmMode` for Common vs Triplets.

- [ ] **Step 1: Update `ProjectSettings` and `createEmptyProject` in `src/core/domain/project.ts`**

  Replace:
  ```ts
  export interface ProjectSettings {
    locale: LocaleCode
    snapDivisor: 4 | 8 | 16
  }
  ```
  With:
  ```ts
  export interface ProjectSettings {
    locale: LocaleCode
    snapDivisor: 1 | 2 | 4 | 8 | 16
    rhythmMode: 'common' | 'triplets'
  }
  ```

  In `createEmptyProject()`, update the `settings` object:
  ```ts
  settings: {
    locale: 'zh-CN',
    snapDivisor: 4,
    rhythmMode: 'common',
  },
  ```

- [ ] **Step 2: Run existing tests to verify no breakage**

  ```
  pnpm test:run "src/core/domain/project.spec.ts"
  ```
  Expected: all pass (the existing test only checks `timingPoints` shape, not settings fields).

- [ ] **Step 3: Add new tests to `src/core/domain/project.spec.ts`**

  Open the file and add inside `describe('createEmptyProject', ...)` (create the describe if it doesn't exist):
  ```ts
  describe('createEmptyProject', () => {
    it('has snapDivisor defaulting to 4', () => {
      const p = createEmptyProject()
      expect(p.settings.snapDivisor).toBe(4)
    })

    it('has rhythmMode defaulting to common', () => {
      const p = createEmptyProject()
      expect(p.settings.rhythmMode).toBe('common')
    })
  })
  ```

- [ ] **Step 4: Run new tests**

  ```
  pnpm test:run "src/core/domain/project.spec.ts"
  ```
  Expected: all pass.

- [ ] **Step 5: Commit**

  ```
  git add src/core/domain/project.ts src/core/domain/project.spec.ts
  git commit -m "feat(data): extend ProjectSettings with rhythmMode and wider snapDivisor

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 3: Add getBeatGridLines to timing-engine

**Files:**
- Modify: `src/core/timing/timing-engine.ts`
- Modify: `src/core/timing/timing-engine.spec.ts`

### Background
`getBeatGridLines` returns all grid line times (bar/beat/subdivision) within a time window. Used by the canvas overlay plugin to draw grid lines without needing Vue.

The triplets rule: `actualDivisor = (triplets && divisor >= 2) ? Math.round(divisor * 3 / 2) : divisor`. So divisor=2 triplets gives 3 subdivisions/beat, divisor=4 gives 6, etc. `divisor=1` always gives 1 (no change).

- [ ] **Step 1: Write the failing test first**

  Add to end of `src/core/timing/timing-engine.spec.ts`:
  ```ts
  // ============================================================
  // getBeatGridLines
  // ============================================================
  describe('getBeatGridLines', () => {
    const BEAT_EPSILON = 1e-9

    it('returns empty array for empty timingPoints', () => {
      expect(getBeatGridLines([], 4, false, 0, 10)).toEqual([])
    })

    it('generates correct lines for 120bpm 4/4, divisor=1 (one per beat), 2 bars', () => {
      // 120bpm: beatDur=0.5s, bpBar=4, divisor=1 → 1 sub/beat → sub spacing=0.5s
      // Bar starts: 0.0, 2.0; beats: 0.5,1.0,1.5,2.5,3.0,3.5; no subdivisions
      const lines = getBeatGridLines(
        [tp({ id: 'p1', time: 0, bpm: 120 })],
        1,
        false,
        0,
        4,
      )
      const bars = lines.filter((l) => l.type === 'bar')
      const beats = lines.filter((l) => l.type === 'beat')
      const subs = lines.filter((l) => l.type === 'subdivision')
      expect(bars.map((l) => l.time)).toEqual([0, 2])
      expect(beats.map((l) => l.time)).toEqual([0.5, 1.0, 1.5, 2.5, 3.0, 3.5])
      expect(subs).toHaveLength(0)
    })

    it('generates subdivision lines for divisor=4', () => {
      // 120bpm: beatDur=0.5s, divisor=4 → subDur=0.125s
      // First beat (0→0.5): bar at 0, subdivisions at 0.125, 0.25, 0.375, beat at 0.5
      const lines = getBeatGridLines(
        [tp({ id: 'p1', time: 0, bpm: 120 })],
        4,
        false,
        0,
        0.5,
      )
      const times = lines.map((l) => l.time)
      expect(times).toHaveLength(4) // 0 (bar), 0.125, 0.25, 0.375
      expect(lines[0].type).toBe('bar')
      expect(lines[1].type).toBe('subdivision')
      expect(lines[2].type).toBe('subdivision')
      expect(lines[3].type).toBe('subdivision')
    })

    it('triplets mode divisor=2 gives 3 subs per beat', () => {
      // actualDivisor = round(2*3/2) = 3; beatDur=0.5, subDur=0.5/3≈0.1667
      // In one beat (0→0.5): bar at 0, subs at 0.1667, 0.3333
      const lines = getBeatGridLines(
        [tp({ id: 'p1', time: 0, bpm: 120 })],
        2,
        true,
        0,
        0.5,
      )
      expect(lines).toHaveLength(3) // bar=0, sub=0.1667, sub=0.3333
      expect(lines[0].type).toBe('bar')
      expect(lines[1].type).toBe('subdivision')
      expect(lines[2].type).toBe('subdivision')
      expect(lines[2].time).toBeCloseTo(1 / 3, 4)
    })

    it('divisor=1 triplets has no effect (actualDivisor stays 1)', () => {
      const normal = getBeatGridLines([tp({ id: 'p1' })], 1, false, 0, 4)
      const triplets = getBeatGridLines([tp({ id: 'p1' })], 1, true, 0, 4)
      expect(triplets).toEqual(normal)
    })

    it('returns lines sorted by time ascending', () => {
      const lines = getBeatGridLines([tp({ id: 'p1' })], 4, false, 0, 2)
      for (let i = 1; i < lines.length; i++) {
        expect(lines[i].time).toBeGreaterThanOrEqual(lines[i - 1].time)
      }
    })

    it('respects startSec and endSec window', () => {
      // Only lines within [1.0, 2.0] should appear
      const lines = getBeatGridLines([tp({ id: 'p1' })], 1, false, 1.0, 2.0)
      expect(lines.every((l) => l.time >= 1.0 - BEAT_EPSILON && l.time <= 2.0 + BEAT_EPSILON)).toBe(true)
    })

    it('handles two timing point segments correctly', () => {
      // Segment 1: 0..4 at 120bpm, Segment 2: 4..∞ at 60bpm
      // beatDur1=0.5, beatDur2=1.0
      const lines = getBeatGridLines(
        [
          tp({ id: 'p1', time: 0, bpm: 120 }),
          tp({ id: 'p2', time: 4, bpm: 60 }),
        ],
        1,
        false,
        3.5,
        5.5,
      )
      // Should include lines from both segments in the window
      const times = lines.map((l) => l.time)
      expect(times.some((t) => t < 4)).toBe(true)
      expect(times.some((t) => t >= 4)).toBe(true)
    })
  })
  ```

- [ ] **Step 2: Run to verify test fails**

  ```
  pnpm test:run "src/core/timing/timing-engine.spec.ts"
  ```
  Expected: new `getBeatGridLines` tests fail with "is not a function".

- [ ] **Step 3: Implement `getBeatGridLines` and `GridLine` in `src/core/timing/timing-engine.ts`**

  Add after all existing imports at the top:
  ```ts
  const SUBDIV_EPSILON = 1e-9
  ```
  (Note: `BEAT_EPSILON` already exists in the file; use a distinct constant name for subdivision math to avoid confusion.)

  Add after the existing exports (end of file):
  ```ts
  export interface GridLine {
    time: number
    type: 'bar' | 'beat' | 'subdivision'
  }

  /**
   * Returns beat-grid lines within [startSec, endSec].
   * divisor: subdivisions per beat (1, 2, 4, 8, 16).
   * triplets: if true and divisor >= 2, actualDivisor = round(divisor * 3 / 2).
   * Returns [] when timingPoints is empty (never throws).
   */
  export function getBeatGridLines(
    timingPoints: TimingPoint[],
    divisor: number,
    triplets: boolean,
    startSec: number,
    endSec: number,
  ): GridLine[] {
    if (timingPoints.length === 0) return []

    const sorted = sortTimingPoints(timingPoints)
    const result: GridLine[] = []

    for (let i = 0; i < sorted.length; i++) {
      const point = sorted[i]
      const segStart = point.time
      const segEnd = i + 1 < sorted.length ? sorted[i + 1].time : Infinity

      // Skip segments entirely outside the window
      if (segEnd <= startSec || segStart >= endSec) continue

      const beatDur = 60 / point.bpm
      const bpBar =
        (point.timeSignatureNumerator * 4) / point.timeSignatureDenominator
      const actualDivisor =
        triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
      const subDur = beatDur / actualDivisor

      const windowStart = Math.max(segStart, startSec)
      const windowEnd = Math.min(segEnd === Infinity ? endSec : segEnd, endSec)

      // First sub index at or after windowStart (relative to segStart)
      const rawStart = (windowStart - segStart) / subDur
      let subIdx = Math.max(0, Math.ceil(rawStart - SUBDIV_EPSILON))

      while (true) {
        const t = segStart + subIdx * subDur
        if (t > windowEnd + SUBDIV_EPSILON) break

        if (t >= windowStart - SUBDIV_EPSILON) {
          const barsPerSeg = bpBar * actualDivisor
          let type: 'bar' | 'beat' | 'subdivision'
          if (subIdx % barsPerSeg === 0) {
            type = 'bar'
          } else if (subIdx % actualDivisor === 0) {
            type = 'beat'
          } else {
            type = 'subdivision'
          }
          result.push({ time: t, type })
        }
        subIdx++
      }
    }

    return result.sort((a, b) => a.time - b.time)
  }
  ```

- [ ] **Step 4: Add import for `getBeatGridLines` in the test file**

  In `src/core/timing/timing-engine.spec.ts`, update the import to include `getBeatGridLines`:
  ```ts
  import {
    getActiveTimingPoint,
    getBeatGridLines,
    getBeatInfoAtTime,
    getNextBarBoundaryTime,
    getNextBeatTime,
    getPreviousBarTime,
  } from './timing-engine'
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```
  pnpm test:run "src/core/timing/timing-engine.spec.ts"
  ```
  Expected: all pass including new `getBeatGridLines` tests.

- [ ] **Step 6: Commit**

  ```
  git add src/core/timing/timing-engine.ts src/core/timing/timing-engine.spec.ts
  git commit -m "feat(timing): add getBeatGridLines for beat/bar/subdivision grid

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 4: Add subdivision seeking helpers to timing-engine

**Files:**
- Modify: `src/core/timing/timing-engine.ts`
- Modify: `src/core/timing/timing-engine.spec.ts`

### Background
`seekToNextBeat`/`seekToPrevBeat` in the store need to navigate to the nearest subdivision boundary. These pure functions mirror `getNextBeatTime`/`getPreviousBarTime` but work at the subdivision level.

- [ ] **Step 1: Write failing tests**

  Add to end of `src/core/timing/timing-engine.spec.ts`:
  ```ts
  // ============================================================
  // getNextSubdivisionTime
  // ============================================================
  describe('getNextSubdivisionTime', () => {
    it('returns next subdivision strictly after given time (divisor=4, 120bpm)', () => {
      // beatDur=0.5, subDur=0.5/4=0.125
      // at time 0.05: current sub=0 (0.0), next=0.125
      expect(getNextSubdivisionTime([tp({ id: 'p1' })], 0.05, 4, false)).toBeCloseTo(0.125, 6)
    })

    it('returns next sub when exactly on sub boundary', () => {
      expect(getNextSubdivisionTime([tp({ id: 'p1' })], 0.125, 4, false)).toBeCloseTo(0.25, 6)
    })

    it('triplets divisor=2 gives subDur=beatDur/3', () => {
      // beatDur=0.5, actualDivisor=3, subDur=0.5/3≈0.1667
      // at time 0.05: sub index=0, next=0.1667
      const t = getNextSubdivisionTime([tp({ id: 'p1' })], 0.05, 2, true)
      expect(t).toBeCloseTo(0.5 / 3, 4)
    })

    it('crosses segment boundary', () => {
      const points = [
        tp({ id: 'p1', time: 0, bpm: 120 }),
        tp({ id: 'p2', time: 2, bpm: 60 }),
      ]
      // p1 beatDur=0.5, divisor=1: next sub after 1.9 = 2.0 (boundary)
      expect(getNextSubdivisionTime(points, 1.9, 1, false)).toBeCloseTo(2.0, 6)
    })

    it('throws for empty timingPoints', () => {
      expect(() => getNextSubdivisionTime([], 0, 4, false)).toThrow()
    })
  })

  // ============================================================
  // getPreviousSubdivisionTime
  // ============================================================
  describe('getPreviousSubdivisionTime', () => {
    it('returns current sub start when not on a boundary (divisor=4)', () => {
      // at 0.05: sub index=0, sub start=0.0
      expect(getPreviousSubdivisionTime([tp({ id: 'p1' })], 0.05, 4, false)).toBeCloseTo(0.0, 6)
    })

    it('returns previous sub when exactly on sub boundary', () => {
      // at 0.125: sub index=1, previous=0.0
      expect(getPreviousSubdivisionTime([tp({ id: 'p1' })], 0.125, 4, false)).toBeCloseTo(0.0, 6)
    })

    it('handles triplets', () => {
      // beatDur=0.5, actualDivisor=3, subDur=0.5/3
      // at time 0.5/3 (exactly on first sub): goes to 0.0
      const subDur = 0.5 / 3
      expect(getPreviousSubdivisionTime([tp({ id: 'p1' })], subDur, 2, true)).toBeCloseTo(0.0, 4)
    })

    it('throws for empty timingPoints', () => {
      expect(() => getPreviousSubdivisionTime([], 0, 4, false)).toThrow()
    })
  })
  ```

- [ ] **Step 2: Run to confirm tests fail**

  ```
  pnpm test:run "src/core/timing/timing-engine.spec.ts"
  ```
  Expected: new tests fail with "is not a function".

- [ ] **Step 3: Implement in `src/core/timing/timing-engine.ts`**

  Add after `getBeatGridLines` at end of file:
  ```ts
  /**
   * Returns the time of the next subdivision boundary strictly after `time`.
   * Uses the same triplets formula as getBeatGridLines.
   * Throws if timingPoints is empty.
   */
  export function getNextSubdivisionTime(
    points: readonly TimingPoint[],
    time: number,
    divisor: number,
    triplets: boolean,
  ): number {
    const sorted = sortTimingPoints(points)
    if (sorted.length === 0) throw new Error(zhCN.errors.noTimingPoints)

    const point = getActiveTimingPoint(sorted, time)
    const beatDur = 60 / point.bpm
    const actualDivisor =
      triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
    const subDur = beatDur / actualDivisor

    const elapsed = (time - point.time) / subDur
    const subIdx = Math.floor(elapsed + BEAT_EPSILON)
    const nextSubTime = point.time + (subIdx + 1) * subDur

    // Cross-segment boundary check
    const pointIndex = sorted.findIndex((p) => p.id === point.id)
    if (pointIndex < sorted.length - 1) {
      const nextPoint = sorted[pointIndex + 1]
      if (nextSubTime >= nextPoint.time) {
        return nextPoint.time
      }
    }

    return nextSubTime
  }

  /**
   * Returns the start time of the subdivision containing `time`,
   * or the previous subdivision if `time` is exactly on a boundary.
   * Throws if timingPoints is empty.
   */
  export function getPreviousSubdivisionTime(
    points: readonly TimingPoint[],
    time: number,
    divisor: number,
    triplets: boolean,
  ): number {
    const sorted = sortTimingPoints(points)
    if (sorted.length === 0) throw new Error(zhCN.errors.noTimingPoints)

    const point = getActiveTimingPoint(sorted, time)
    const beatDur = 60 / point.bpm
    const actualDivisor =
      triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
    const subDur = beatDur / actualDivisor

    const elapsed = (time - point.time) / subDur
    const subIdx = Math.floor(elapsed + BEAT_EPSILON)
    const currentSubStart = point.time + subIdx * subDur
    const isExactlyOnSub = Math.abs(time - currentSubStart) < BEAT_EPSILON

    return isExactlyOnSub
      ? point.time + (subIdx - 1) * subDur
      : currentSubStart
  }
  ```

- [ ] **Step 4: Update imports in test file**

  In `src/core/timing/timing-engine.spec.ts`, update the import to include the new functions:
  ```ts
  import {
    getActiveTimingPoint,
    getBeatGridLines,
    getBeatInfoAtTime,
    getNextBarBoundaryTime,
    getNextBeatTime,
    getNextSubdivisionTime,
    getPreviousBarTime,
    getPreviousSubdivisionTime,
  } from './timing-engine'
  ```

- [ ] **Step 5: Run tests**

  ```
  pnpm test:run "src/core/timing/timing-engine.spec.ts"
  ```
  Expected: all pass.

- [ ] **Step 6: Commit**

  ```
  git add src/core/timing/timing-engine.ts src/core/timing/timing-engine.spec.ts
  git commit -m "feat(timing): add getNextSubdivisionTime, getPreviousSubdivisionTime

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 5: Add project-commands for rhythmMode and snapDivisor

**Files:**
- Modify: `src/core/commands/project-commands.ts`
- Modify: `src/core/commands/project-commands.spec.ts`

- [ ] **Step 1: Write failing tests**

  Add to end of `src/core/commands/project-commands.spec.ts`:
  ```ts
  describe('settings commands', () => {
    it('createSetRhythmModeCommand sets rhythmMode and is undoable', () => {
      const cmd = createSetRhythmModeCommand('triplets')
      const after = cmd.do(createEmptyProject())
      expect(after.settings.rhythmMode).toBe('triplets')
      const undone = cmd.undo(after)
      expect(undone.settings.rhythmMode).toBe('common')
    })

    it('createSetSnapDivisorCommand sets snapDivisor and is undoable', () => {
      const cmd = createSetSnapDivisorCommand(16)
      const after = cmd.do(createEmptyProject())
      expect(after.settings.snapDivisor).toBe(16)
      const undone = cmd.undo(after)
      expect(undone.settings.snapDivisor).toBe(4)
    })
  })
  ```

- [ ] **Step 2: Run to confirm tests fail**

  ```
  pnpm test:run "src/core/commands/project-commands.spec.ts"
  ```

- [ ] **Step 3: Implement in `src/core/commands/project-commands.ts`**

  Add after `createSetAudioVolumeCommand` at end of file:
  ```ts
  export function createSetRhythmModeCommand(
    mode: 'common' | 'triplets',
  ): Command<ProjectDocument> {
    let previous: 'common' | 'triplets' | undefined
    return {
      label: 'settings.setRhythmMode',
      do: (state) => {
        previous = state.settings.rhythmMode
        return { ...state, settings: { ...state.settings, rhythmMode: mode } }
      },
      undo: (state) => {
        if (previous === undefined) return state
        return { ...state, settings: { ...state.settings, rhythmMode: previous } }
      },
    }
  }

  export function createSetSnapDivisorCommand(
    divisor: 1 | 2 | 4 | 8 | 16,
  ): Command<ProjectDocument> {
    let previous: 1 | 2 | 4 | 8 | 16 | undefined
    return {
      label: 'settings.setSnapDivisor',
      do: (state) => {
        previous = state.settings.snapDivisor
        return { ...state, settings: { ...state.settings, snapDivisor: divisor } }
      },
      undo: (state) => {
        if (previous === undefined) return state
        return {
          ...state,
          settings: { ...state.settings, snapDivisor: previous },
        }
      },
    }
  }
  ```

- [ ] **Step 4: Update imports in test file**

  In `src/core/commands/project-commands.spec.ts`:
  ```ts
  import {
    createAddTimingPointCommand,
    createRemoveTimingPointCommand,
    createSetAudioVolumeCommand,
    createSetRhythmModeCommand,
    createSetSnapDivisorCommand,
    createUpdateTimingPointCommand,
  } from './project-commands'
  ```

- [ ] **Step 5: Run tests**

  ```
  pnpm test:run "src/core/commands/project-commands.spec.ts"
  ```
  Expected: all pass.

- [ ] **Step 6: Commit**

  ```
  git add src/core/commands/project-commands.ts src/core/commands/project-commands.spec.ts
  git commit -m "feat(commands): add setRhythmMode and setSnapDivisor commands

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 6: Add new store actions

**Files:**
- Modify: `src/stores/editor-store.ts`

### Background
New actions needed:
- `audioFile` — expose the last-loaded `File` so WaveSurfer can re-load it for rendering
- `setRhythmMode(mode)` — writes `rhythmMode` via command
- `setSnapDivisor(divisor)` — writes `snapDivisor` via command
- `seekToNextBeat(divisor, triplets)` — jump forward one subdivision
- `seekToPrevBeat(divisor, triplets)` — jump backward one subdivision

- [ ] **Step 1: Add imports to `src/stores/editor-store.ts`**

  Find the existing import block for timing-engine and add the two new functions:
  ```ts
  import {
    getActiveTimingPoint,
    getBeatInfoAtTime,
    getNextBarBoundaryTime,
    getNextBeatTime,
    getNextSubdivisionTime,
    getPreviousBarTime,
    getPreviousSubdivisionTime,
  } from '../core/timing/timing-engine'
  ```

  Find the existing import block for project-commands and add the two new commands:
  ```ts
  import {
    createAddLyricLineCommand,
    createAddTimingPointCommand,
    createRemoveTimingPointCommand,
    createSetAudioVolumeCommand,
    createSetRhythmModeCommand,
    createSetSnapDivisorCommand,
    createUpdateTimingPointCommand,
  } from '../core/commands/project-commands'
  ```

- [ ] **Step 2: Add `_audioFile` shallowRef and update `importAudioFile`**

  Find the existing reactive state declarations (near `_currentTime = ref(0)`) and add:
  ```ts
  const _audioFile = shallowRef<File | null>(null)
  ```

  Find `importAudioFile` and add `_audioFile.value = file` BEFORE the first `await`:
  ```ts
  async function importAudioFile(file: File): Promise<void> {
    _audioFile.value = file   // ← must be before first await
    const transport = _ensureAudioTransport()
    await transport.loadFile(file)
    triggerRef(_audioTransport)
  }
  ```

- [ ] **Step 3: Add the four new action functions**

  Add these after `seekToNextBar` and before the `return` statement:
  ```ts
  function setRhythmMode(mode: 'common' | 'triplets'): void {
    execute(createSetRhythmModeCommand(mode))
  }

  function setSnapDivisor(divisor: 1 | 2 | 4 | 8 | 16): void {
    execute(createSetSnapDivisorCommand(divisor))
  }

  function seekToNextBeat(divisor: number, triplets: boolean): void {
    if (project.value.timingPoints.length === 0) return
    const t = getNextSubdivisionTime(
      project.value.timingPoints,
      _currentTime.value,
      divisor,
      triplets,
    )
    seekPlayback(Math.min(duration.value, t))
  }

  function seekToPrevBeat(divisor: number, triplets: boolean): void {
    if (project.value.timingPoints.length === 0) return
    const t = getPreviousSubdivisionTime(
      project.value.timingPoints,
      _currentTime.value,
      divisor,
      triplets,
    )
    seekPlayback(Math.max(0, t))
  }
  ```

- [ ] **Step 4: Expose new items in the store's return object**

  Add to the return object:
  ```ts
  // Phase 3: audio file reference (for WaveSurfer)
  audioFile: computed(() => _audioFile.value),

  // Phase 3: settings
  setRhythmMode,
  setSnapDivisor,

  // Phase 3: beat-level seek
  seekToNextBeat,
  seekToPrevBeat,
  ```

- [ ] **Step 5: Run the full store test suite**

  ```
  pnpm test:run "src/stores/editor-store.spec.ts"
  ```
  Expected: all existing tests pass (new actions are untested here; tested via integration later).

- [ ] **Step 6: Commit**

  ```
  git add src/stores/editor-store.ts
  git commit -m "feat(store): add audioFile, setRhythmMode, setSnapDivisor, seekToNextBeat, seekToPrevBeat

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 7: Add new ShortcutAction types and register shortcuts

**Files:**
- Modify: `src/platform/shortcuts/registry.ts`
- Modify: `src/composables/useEditorShortcuts.ts`

- [ ] **Step 1: Extend `ShortcutAction` in `src/platform/shortcuts/registry.ts`**

  Replace:
  ```ts
  export type ShortcutAction =
    | 'history.undo'
    | 'history.redo'
    | 'project.save'
    | 'transport.togglePlay'
    | 'timing.tapBpm'
    | 'metronome.toggle'
  ```
  With:
  ```ts
  export type ShortcutAction =
    | 'history.undo'
    | 'history.redo'
    | 'project.save'
    | 'transport.togglePlay'
    | 'transport.prevBeat'
    | 'transport.nextBeat'
    | 'transport.prevBar'
    | 'transport.nextBar'
    | 'timing.tapBpm'
    | 'metronome.toggle'
  ```

- [ ] **Step 2: Register the four new shortcuts in `src/composables/useEditorShortcuts.ts`**

  Find the block of `registry.register(...)` calls and add:
  ```ts
  registry.register('ArrowLeft', 'transport.prevBeat')
  registry.register('ArrowRight', 'transport.nextBeat')
  registry.register('Shift+ArrowLeft', 'transport.prevBar')
  registry.register('Shift+ArrowRight', 'transport.nextBar')
  ```

  **Important:** Arrow keys fire even when focus is in a text input for navigating text. The existing guard `if (inInput) return` already handles this. No changes needed there.

- [ ] **Step 3: Run shortcut tests**

  ```
  pnpm test:run "src/composables/useEditorShortcuts.spec.ts"
  pnpm test:run "src/platform/shortcuts/registry.spec.ts"
  ```
  Expected: all pass (new actions are registered but not yet handled in `onAction` — AppShell will handle them in Task 12).

- [ ] **Step 4: Commit**

  ```
  git add src/platform/shortcuts/registry.ts src/composables/useEditorShortcuts.ts
  git commit -m "feat(shortcuts): add transport prevBeat/nextBeat/prevBar/nextBar actions

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 8: Update zh-CN.json with new i18n keys

**Files:**
- Modify: `src/platform/i18n/locales/zh-CN.json`

- [ ] **Step 1: Add new keys**

  In the `"transport"` section, add after `"sfxVolume"`:
  ```json
  "waveformMode": "波形",
  "spectrogramMode": "频谱",
  "toggleViewMode": "切换波形/频谱",
  "subdivisionDivisor": "细分",
  "rhythmMode": "节奏",
  "rhythmCommon": "普通",
  "rhythmTriplets": "三连音",
  "rhythmTripletsAlt": "三连音 (Alt)",
  "verticalZoom": "垂直缩放",
  "subdivision1x": "1x (每拍1格)",
  "subdivision2x": "2x (每拍2格)",
  "subdivision4x": "4x (每拍4格)",
  "subdivision8x": "8x (每拍8格)",
  "subdivision16x": "16x (每拍16格)"
  ```

  In the `"errors"` section, add:
  ```json
  "waveformLoadFailed": "波形加载失败"
  ```

- [ ] **Step 2: Run i18n tests**

  ```
  pnpm test:run "src/platform/i18n/index.spec.ts"
  ```
  Expected: all pass.

- [ ] **Step 3: Commit**

  ```
  git add src/platform/i18n/locales/zh-CN.json
  git commit -m "i18n: add Phase 3 transport and waveform keys

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 9: Create grid-overlay-plugin.ts

**Files:**
- Create: `src/platform/waveform/grid-overlay-plugin.ts`

### Background
This is a WaveSurfer `BasePlugin` that:
1. On `onInit()`: appends a `<canvas>` to the WaveSurfer scroll container (`getWrapper().parentElement`). The canvas is viewport-sized (`position: absolute; inset: 0`), so it overlays the waveform without scrolling with the content.
2. Stores visible time range from WaveSurfer's `scroll` event.
3. On `update(params)` or any redraw event: clears the canvas and draws grid lines + playhead.
4. Drawing: `x = (time - visibleStart) * (canvas.width / visibleDuration)`. Lines for bar (white 0.8 opacity, 2px), beat (white 0.5, 1px), subdivision (white 0.2, 1px). Playhead: red 0.9, 2px.

**Important note on WaveSurfer shadow DOM:**
`getWrapper()` returns the `#wrapper` div inside WaveSurfer's shadow DOM. `getWrapper().parentElement` is the `#scroll` div, also in shadow DOM. We can append the canvas to it since we hold a reference.

**Import path for BasePlugin:**
From `wavesurfer.js` v7+, `BasePlugin` is exported from the main package entry:
```ts
import { BasePlugin, type BasePluginEvents } from 'wavesurfer.js'
```
If this import fails (package structure varies), try:
```ts
import { BasePlugin, type BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'
```

- [ ] **Step 1: Create `src/platform/waveform/grid-overlay-plugin.ts`**

  ```ts
  import { BasePlugin, type BasePluginEvents } from 'wavesurfer.js'

  import { getBeatGridLines } from '../../core/timing/timing-engine'
  import type { TimingPoint } from '../../core/domain/project'

  export interface GridOverlayParams {
    timingPoints: TimingPoint[]
    currentTime: number
    divisor: number
    triplets: boolean
  }

  export class GridOverlayPlugin extends BasePlugin<BasePluginEvents, object> {
    private canvas: HTMLCanvasElement | null = null
    private params: GridOverlayParams = {
      timingPoints: [],
      currentTime: 0,
      divisor: 4,
      triplets: false,
    }
    private visibleStart = 0
    private visibleEnd = 0

    static create(): GridOverlayPlugin {
      return new GridOverlayPlugin({})
    }

    protected onInit(): void {
      const ws = this.wavesurfer!
      const wrapper = ws.getWrapper()
      const scrollContainer = wrapper.parentElement

      if (!scrollContainer) return

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
      scrollContainer.style.position = 'relative'
      scrollContainer.appendChild(this.canvas)

      this.subscriptions.push(
        ws.on('scroll', (start, end) => {
          this.visibleStart = start
          this.visibleEnd = end
          this._draw()
        }),
        ws.on('redraw', () => this._draw()),
        ws.on('zoom', () => this._draw()),
        ws.on('ready', () => this._draw()),
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
      const px = Math.round((this.params.currentTime - this.visibleStart) * pxPerSec) + 0.5
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

- [ ] **Step 2: Verify TypeScript compiles**

  ```
  pnpm check
  ```
  Expected: no errors. If `BasePlugin` import fails, adjust the import path (see note above).

- [ ] **Step 3: Commit**

  ```
  git add src/platform/waveform/grid-overlay-plugin.ts
  git commit -m "feat(waveform): add GridOverlayPlugin for beat/bar/playhead canvas overlay

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 10: Create wavesurfer-view.ts

**Files:**
- Create: `src/platform/waveform/wavesurfer-view.ts`

### Background
Thin factory wrapper around a `WaveSurfer` instance. Handles:
- Creating WaveSurfer with waveform or spectrogram mode
- Loading audio via `loadBlob`
- Zoom control (`zoom(pxPerSec)`)
- Auto-center scrolling (`scrollTo(time)`)
- Getting current scroll position in seconds (`getScrollTime()`)
- Event subscription passthrough (`on`)
- Plugin registration (`registerPlugin`)
- Cleanup (`destroy`)

Mode switching (waveform ↔ spectrogram) is handled in `useTimelineView` by calling `destroy()` then `createWaveSurferView` again.

**Spectrogram plugin import:**
After Task 1 Step 3 you know the exact path. Typically:
```ts
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'
```
or
```ts
import SpectrogramPlugin from 'wavesurfer.js/plugins/spectrogram'
```
Use whichever worked in Task 1 Step 3. The plugin is imported only when mode=`'spectrogram'`, via dynamic import in `_initSpectrogram()`.

- [ ] **Step 1: Create `src/platform/waveform/wavesurfer-view.ts`**

  ```ts
  import WaveSurfer from 'wavesurfer.js'
  import type { BasePlugin } from 'wavesurfer.js'

  export interface WaveSurferViewOptions {
    mode: 'waveform' | 'spectrogram'
    minPxPerSec: number
  }

  export interface WaveSurferView {
    registerPlugin<T extends BasePlugin>(plugin: T): T
    loadBlob(blob: Blob): Promise<void>
    zoom(pxPerSec: number): void
    scrollTo(time: number): void
    getScrollTime(): number
    on(event: string, handler: (...args: unknown[]) => void): () => void
    destroy(): void
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
      interact: false,
      hideScrollbar: false,
    })

    if (options.mode === 'spectrogram') {
      void _initSpectrogram(ws)
    }

    async function _initSpectrogram(instance: WaveSurfer): Promise<void> {
      try {
        const { default: SpectrogramPlugin } = await import(
          /* @vite-ignore */ 'wavesurfer.js/dist/plugins/spectrogram.esm.js'
        )
        instance.registerPlugin(
          SpectrogramPlugin.create({
            fftSamples: 1024,
            labels: true,
          }),
        )
      } catch {
        // Spectrogram plugin unavailable; gracefully degrade to waveform only
      }
    }

    function _getScrollContainer(): HTMLElement | null {
      return ws.getWrapper().parentElement
    }

    return {
      registerPlugin<T extends BasePlugin>(plugin: T): T {
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

- [ ] **Step 2: Verify TypeScript compiles**

  ```
  pnpm check
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```
  git add src/platform/waveform/wavesurfer-view.ts
  git commit -m "feat(waveform): add createWaveSurferView lifecycle wrapper

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 11: Create useTimelineView.ts

**Files:**
- Create: `src/composables/useTimelineView.ts`

### Background
This composable is created in `AppShell`, provided to children via `provide/inject`. It:
- Accepts `containerRef: ShallowRef<HTMLElement | null>` — set by `MainView` on mount
- Watches `containerRef` to initialize WaveSurfer when the element becomes available
- Watches `store.audioFile` to call `wavesurferView.loadBlob()` when audio changes
- Watches `store.currentTime` to redraw the grid overlay and auto-scroll
- Tracks `Alt` keydown/keyup to set `altTripletActive`
- Exposes `setViewMode`, `onWheel`, and all state refs to consumers

The `divisor` and `rhythmMode` refs are computed from the store (they're project-persisted via commands). The `verticalZoom` is local UI state (not persisted; resets when page reloads).

**InjectionKey:**
```ts
export const TIMELINE_VIEW_KEY: InjectionKey<TimelineViewContext> = Symbol('timelineView')
```

- [ ] **Step 1: Create `src/composables/useTimelineView.ts`**

  ```ts
  import {
    type InjectionKey,
    type ShallowRef,
    computed,
    onMounted,
    onUnmounted,
    ref,
    watch,
    watchEffect,
  } from 'vue'

  import { useEditorStore } from '../stores/editor-store'
  import { GridOverlayPlugin } from '../platform/waveform/grid-overlay-plugin'
  import {
    createWaveSurferView,
    type WaveSurferView,
  } from '../platform/waveform/wavesurfer-view'

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

    function _initWaveSurfer(container: HTMLElement): void {
      wavesurferView = createWaveSurferView(container, {
        mode: viewMode.value,
        minPxPerSec: pxPerSec.value,
      })
      gridPlugin = wavesurferView.registerPlugin(GridOverlayPlugin.create())

      if (store.audioFile) {
        void wavesurferView.loadBlob(store.audioFile)
      }
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
      if (mode === viewMode.value) return
      const container = containerRef.value
      const scrollTime = wavesurferView?.getScrollTime() ?? 0

      wavesurferView?.destroy()
      wavesurferView = null
      gridPlugin = null

      viewMode.value = mode

      if (container) {
        _initWaveSurfer(container)
        // Restore scroll position after audio reloads
        if (store.audioFile) {
          wavesurferView
            ?.loadBlob(store.audioFile)
            .then(() => wavesurferView?.scrollTo(scrollTime))
        }
      }
    }

    function setVerticalZoom(v: number): void {
      verticalZoom.value = Math.max(0.5, Math.min(10, v))
    }

    /**
     * Wheel event handler for the waveform container.
     * Ctrl+wheel → horizontal zoom; Shift+wheel → subdivision divisor change.
     * Plain scroll is handled natively by WaveSurfer — do NOT call this for plain scroll.
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
      setViewMode,
      setVerticalZoom,
      onWheel,
    }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```
  pnpm check
  ```
  Expected: no errors.

- [ ] **Step 3: Write composable unit tests**

  Create `src/composables/useTimelineView.spec.ts`:
  ```ts
  import { mount } from '@vue/test-utils'
  import { createPinia, setActivePinia } from 'pinia'
  import { beforeEach, describe, expect, it, vi } from 'vitest'
  import { defineComponent, h, shallowRef } from 'vue'

  import {
    __overrideAudioTransportFactory,
    __overrideMetronomeFactory,
  } from '../stores/editor-store'
  import { useTimelineView } from './useTimelineView'

  // Mock WaveSurfer to avoid DOM/canvas errors in happy-dom
  vi.mock('wavesurfer.js', () => {
    const mockWs = {
      getWrapper: vi.fn(() => {
        const wrapper = document.createElement('div')
        const parent = document.createElement('div')
        parent.appendChild(wrapper)
        return wrapper
      }),
      getDuration: vi.fn(() => 0),
      on: vi.fn(() => () => {}),
      zoom: vi.fn(),
      loadBlob: vi.fn(async () => {}),
      registerPlugin: vi.fn((p: unknown) => p),
      destroy: vi.fn(),
    }
    return {
      default: { create: vi.fn(() => mockWs) },
      BasePlugin: class {
        protected wavesurfer: unknown = null
        protected subscriptions: Array<() => void> = []
        destroy() {
          this.subscriptions.forEach((fn) => fn())
        }
      },
    }
  })

  function mountHarness(
    setup: () => void,
  ): ReturnType<typeof mount> {
    return mount(
      defineComponent({
        setup() {
          setup()
          return () => h('div')
        },
      }),
    )
  }

  describe('useTimelineView', () => {
    beforeEach(() => {
      __overrideAudioTransportFactory(() => ({
        loadFile: vi.fn(async () => {}),
        play: vi.fn(async () => {}),
        pause: vi.fn(),
        seek: vi.fn(),
        getCurrentTime: vi.fn(() => 0),
        getDuration: vi.fn(() => 0),
        setVolume: vi.fn(),
        getVolume: vi.fn(() => 1),
        getIsPlaying: vi.fn(() => false),
        destroy: vi.fn(),
      }))
      __overrideMetronomeFactory(() => ({
        setEnabled: vi.fn(),
        setSfxVolume: vi.fn(),
        syncToTimeline: vi.fn(),
        hasPendingLatch: vi.fn(() => false),
        getLoadError: vi.fn(() => null),
        destroy: vi.fn(),
      }))
      setActivePinia(createPinia())
    })

    it('altTripletActive becomes true on Alt keydown and false on keyup', async () => {
      let timeline: ReturnType<typeof useTimelineView> | undefined
      const containerRef = shallowRef<HTMLElement | null>(null)
      const wrapper = mountHarness(() => {
        timeline = useTimelineView(containerRef)
      })

      expect(timeline!.altTripletActive.value).toBe(false)

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(timeline!.altTripletActive.value).toBe(true)

      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(timeline!.altTripletActive.value).toBe(false)

      wrapper.unmount()
    })

    it('setViewMode updates viewMode', () => {
      let timeline: ReturnType<typeof useTimelineView> | undefined
      const containerRef = shallowRef<HTMLElement | null>(null)
      const wrapper = mountHarness(() => {
        timeline = useTimelineView(containerRef)
      })

      expect(timeline!.viewMode.value).toBe('waveform')
      timeline!.setViewMode('spectrogram')
      expect(timeline!.viewMode.value).toBe('spectrogram')

      wrapper.unmount()
    })

    it('onWheel with ctrlKey updates pxPerSec', () => {
      let timeline: ReturnType<typeof useTimelineView> | undefined
      const containerRef = shallowRef<HTMLElement | null>(null)
      const wrapper = mountHarness(() => {
        timeline = useTimelineView(containerRef)
      })

      const initialPps = timeline!.pxPerSec.value
      timeline!.onWheel(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100 }))
      expect(timeline!.pxPerSec.value).toBeGreaterThan(initialPps)

      wrapper.unmount()
    })

    it('effectiveTriplets is true when rhythmMode is triplets', async () => {
      let timeline: ReturnType<typeof useTimelineView> | undefined
      const containerRef = shallowRef<HTMLElement | null>(null)
      const wrapper = mountHarness(() => {
        timeline = useTimelineView(containerRef)
      })

      expect(timeline!.effectiveTriplets.value).toBe(false)
      // rhythmMode is a computed writable backed by the store
      timeline!.rhythmMode.value = 'triplets'
      await wrapper.vm.$nextTick()
      expect(timeline!.effectiveTriplets.value).toBe(true)

      wrapper.unmount()
    })
  })
  ```

- [ ] **Step 4: Run composable tests**

  ```
  pnpm test:run "src/composables/useTimelineView.spec.ts"
  ```
  Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

  ```
  git add src/composables/useTimelineView.ts src/composables/useTimelineView.spec.ts
  git commit -m "feat(composable): add useTimelineView with WaveSurfer orchestration

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 12: Modify MainView.vue

**Files:**
- Modify: `src/components/shell/MainView.vue`
- Modify: `src/components/shell/MainView.spec.ts`

### Background
Replace the placeholder div with:
1. A `div.waveform-content` that WaveSurfer mounts into (emits its ref to AppShell via the injected `timelineContainerRef`)
2. A vertical zoom slider (visible only in `spectrogram` mode) on the right edge
3. A Phase 4 placeholder div below the waveform area
4. Wheel event handling (capture phase, passive:false) for Ctrl/Shift combos
5. Preserve the existing resize handle functionality

The `timelineContainerRef` and `timeline` context are **injected** from `AppShell` (provided in Task 13).

- [ ] **Step 1: Rewrite `src/components/shell/MainView.vue`**

  ```vue
  <script setup lang="ts">
  import { inject, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'

  import type { ShallowRef } from 'vue'
  import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'

  const { t } = useI18n()

  // Injected from AppShell
  const timeline = inject(TIMELINE_VIEW_KEY)
  const timelineContainerRef =
    inject<ShallowRef<HTMLElement | null>>('timelineContainerRef')

  // ---- Resize handle ----
  const height = ref(250)
  const min = 180
  const max = 520

  let dragging = false
  let startY = 0
  let startHeight = 0

  function onPointerDown(e: PointerEvent) {
    dragging = true
    startY = e.clientY
    startHeight = height.value
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    const delta = e.clientY - startY
    height.value = Math.max(min, Math.min(max, startHeight + delta))
  }

  function onPointerUp() {
    dragging = false
  }

  // ---- WaveSurfer container ref ----
  const waveformEl = ref<HTMLElement | null>(null)

  onMounted(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    // Register container with AppShell's useTimelineView
    if (timelineContainerRef && waveformEl.value) {
      timelineContainerRef.value = waveformEl.value
    }

    // Wheel handler: intercept Ctrl/Shift combinations before WaveSurfer sees them
    waveformEl.value?.addEventListener('wheel', onWheel, {
      passive: false,
      capture: true,
    })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    waveformEl.value?.removeEventListener('wheel', onWheel, { capture: true })

    // Unregister from parent
    if (timelineContainerRef) timelineContainerRef.value = null
  })

  function onWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      timeline?.onWheel(e)
    }
    // Plain scroll: let WaveSurfer handle natively (no stopPropagation)
  }

  // ---- Vertical zoom slider (spectrogram mode) ----
  function onVerticalZoomWheel(e: WheelEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY < 0 ? 0.1 : -0.1
    const next = (timeline?.verticalZoom.value ?? 1) + delta
    timeline?.setVerticalZoom(next)
  }
  </script>

  <template>
    <section
      data-testid="main-view-container"
      :style="{ height: `${height}px` }"
      class="relative border-b border-base-300 bg-base-200/30"
    >
      <!-- WaveSurfer mount point -->
      <div
        ref="waveformEl"
        data-testid="waveform-container"
        class="h-full w-full overflow-hidden"
      />

      <!-- Vertical zoom slider — only in spectrogram mode -->
      <div
        v-if="timeline?.viewMode.value === 'spectrogram'"
        data-testid="vertical-zoom-slider"
        class="absolute right-0 top-0 flex h-full w-6 flex-col items-center justify-center bg-base-100/60"
        @wheel.prevent="onVerticalZoomWheel"
      >
        <span class="mb-1 origin-center -rotate-90 text-[9px] text-base-content/60">
          {{ t('transport.verticalZoom') }}
        </span>
        <div class="relative h-24 w-6">
          <input
            class="range range-xs absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-90"
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            :value="timeline?.verticalZoom.value ?? 1"
            @input="
              timeline?.setVerticalZoom(
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
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

- [ ] **Step 2: Update `src/components/shell/MainView.spec.ts`** to verify new elements and preserve existing resize tests.

  The existing resize tests rely on `data-testid="main-view-container"` and `data-testid="main-view-resize-handle"` — both are preserved. Run existing tests first:
  ```
  pnpm test:run "src/components/shell/MainView.spec.ts"
  ```
  Expected: all existing tests still pass.

  Now add two new tests:
  ```ts
  it('renders waveform-container div', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="waveform-container"]').exists()).toBe(true)
  })

  it('renders word-timeline-bar-slot placeholder', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="word-timeline-bar-slot"]').exists()).toBe(true)
  })

  it('vertical-zoom-slider is not rendered in waveform mode (default)', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="vertical-zoom-slider"]').exists()).toBe(false)
  })
  ```

- [ ] **Step 3: Run all MainView tests**

  ```
  pnpm test:run "src/components/shell/MainView.spec.ts"
  ```
  Expected: all pass. (The `v-if` for vertical zoom slider evaluates to false since no timeline context is injected in the test, so the slider is not rendered.)

- [ ] **Step 4: Commit**

  ```
  git add src/components/shell/MainView.vue src/components/shell/MainView.spec.ts
  git commit -m "feat(ui): rebuild MainView with WaveSurfer container and vertical zoom

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 13: Modify TransportBar.vue

**Files:**
- Modify: `src/components/shell/TransportBar.vue`
- Modify: `src/components/shell/TransportBar.spec.ts`

### Background
New controls added (left-to-right order):
1. **Waveform/spectrogram toggle button** — leftmost, before metronome
2. **Subdivision dropdown** — after snap toggle, options 1x/2x/4x/8x/16x
3. **Rhythm mode dropdown** — after subdivision dropdown, options Common/Triplets; shows "(Alt)" label when `altTripletActive`

The `timeline` context is injected from `AppShell` (`TIMELINE_VIEW_KEY`). If not injected (e.g., in tests), controls should gracefully not render or use safe defaults.

- [ ] **Step 1: Update `src/components/shell/TransportBar.vue`**

  Replace the entire `<script setup>` section:
  ```vue
  <script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { inject, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { formatTimestamp } from '../../core/utils/format-timestamp'
  import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'
  import { useEditorStore } from '../../stores/editor-store'

  const { t } = useI18n()
  const store = useEditorStore()
  const timeline = inject(TIMELINE_VIEW_KEY)

  const musicPopoverOpen = ref(false)
  const sfxPopoverOpen = ref(false)

  function onSeek(event: Event): void {
    const input = event.target as HTMLInputElement
    store.seekPlayback(input.valueAsNumber)
  }

  function onMusicWheel(event: WheelEvent): void {
    event.preventDefault()
    const delta = event.deltaY < 0 ? 0.05 : -0.05
    store.setMusicVolume(
      Math.max(0, Math.min(1, store.project.audio.musicVolume + delta)),
    )
  }

  function onSfxWheel(event: WheelEvent): void {
    event.preventDefault()
    const delta = event.deltaY < 0 ? 0.05 : -0.05
    store.setSfxVolume(Math.max(0, Math.min(1, store.project.audio.sfxVolume + delta)))
  }

  const SUBDIVISION_OPTIONS = [
    { value: 1 as const, label: '1x' },
    { value: 2 as const, label: '2x' },
    { value: 4 as const, label: '4x' },
    { value: 8 as const, label: '8x' },
    { value: 16 as const, label: '16x' },
  ]
  </script>
  ```

  Replace the `<template>` section:
  ```vue
  <template>
    <section class="flex items-center gap-2 border-b border-base-300 px-2 py-1.5">
      <!-- Waveform / Spectrogram toggle -->
      <button
        v-if="timeline"
        data-testid="view-mode-toggle"
        class="btn btn-ghost btn-sm btn-square"
        :title="t('transport.toggleViewMode')"
        @click="timeline.setViewMode(
          timeline.viewMode.value === 'waveform' ? 'spectrogram' : 'waveform'
        )"
      >
        <Icon
          v-if="timeline.viewMode.value === 'waveform'"
          icon="material-symbols:waveform"
          class="h-5 w-5"
        />
        <Icon v-else icon="material-symbols:graphic-eq-rounded" class="h-5 w-5" />
      </button>

      <!-- Metronome -->
      <button
        data-testid="metronome-toggle"
        class="btn btn-ghost btn-sm btn-square"
        :class="{ 'btn-active text-primary': store.isMetronomeEnabled }"
        :title="t('transport.metronome')"
        @click="store.toggleMetronome()"
      >
        <Icon icon="lucide:metronome" class="h-5 w-5" />
      </button>

      <!-- Snap -->
      <button
        data-testid="snap-toggle"
        class="btn btn-ghost btn-sm btn-square"
        :title="t('transport.snap')"
        disabled
      >
        <Icon icon="mynaui:magnet" class="h-5 w-5" />
      </button>

      <!-- Subdivision divisor dropdown -->
      <select
        v-if="timeline"
        data-testid="subdivision-select"
        class="select select-xs w-20"
        :title="t('transport.subdivisionDivisor')"
        :value="timeline.divisor.value"
        @change="
          timeline.divisor.value = Number(($event.target as HTMLSelectElement).value) as 1|2|4|8|16
        "
      >
        <option
          v-for="opt in SUBDIVISION_OPTIONS"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>

      <!-- Rhythm mode dropdown -->
      <select
        v-if="timeline"
        data-testid="rhythm-mode-select"
        class="select select-xs w-24"
        :title="t('transport.rhythmMode')"
        :value="timeline.rhythmMode.value"
        @change="
          timeline.rhythmMode.value = ($event.target as HTMLSelectElement).value as 'common'|'triplets'
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

      <div class="mx-1 h-5 w-px bg-base-300" />

      <!-- Prev bar -->
      <button
        data-testid="prev-bar"
        class="btn btn-ghost btn-sm btn-square"
        :title="t('transport.prevBar')"
        @click="store.seekToPreviousBar()"
      >
        <Icon icon="material-symbols:skip-previous-rounded" class="h-5 w-5" />
      </button>

      <!-- Play/Pause -->
      <button
        data-testid="play-pause"
        class="btn btn-ghost btn-sm btn-square"
        :title="t('transport.playPause')"
        @click="store.togglePlayback()"
      >
        <Icon
          v-if="store.isPlaying"
          icon="material-symbols:pause-rounded"
          class="h-5 w-5"
        />
        <Icon v-else icon="material-symbols:play-arrow-rounded" class="h-5 w-5" />
      </button>

      <!-- Next bar -->
      <button
        data-testid="next-bar"
        class="btn btn-ghost btn-sm btn-square"
        :title="t('transport.nextBar')"
        @click="store.seekToNextBar()"
      >
        <Icon icon="material-symbols:skip-next-rounded" class="h-5 w-5" />
      </button>

      <!-- Time display -->
      <span data-testid="time-display" class="text-xs tabular-nums">
        {{ formatTimestamp(store.currentTime) }} / {{ formatTimestamp(store.duration) }}
      </span>

      <!-- Progress slider -->
      <input
        data-testid="playback-progress"
        type="range"
        min="0"
        :max="store.duration || 0"
        step="0.001"
        :value="store.currentTime"
        class="range range-xs flex-1"
        :disabled="store.duration <= 0"
        @input="onSeek"
      />

      <!-- Music volume -->
      <div
        data-testid="music-volume"
        class="relative"
        @mouseenter="musicPopoverOpen = true"
        @mouseleave="musicPopoverOpen = false"
        @wheel="onMusicWheel"
      >
        <button
          class="btn btn-ghost btn-sm btn-square"
          :title="t('transport.musicVolume')"
        >
          <Icon icon="material-symbols:music-note-rounded" class="h-5 w-5" />
        </button>
        <div
          v-show="musicPopoverOpen"
          class="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded-md border border-base-300 bg-base-100 px-2 py-2 shadow-lg"
        >
          <div class="mb-1 text-center text-[10px] tabular-nums">
            {{ Math.round(store.project.audio.musicVolume * 100) }}%
          </div>
          <div class="relative h-24 w-6">
            <input
              class="range range-xs absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-90"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="store.project.audio.musicVolume"
              @input="
                store.setMusicVolume(($event.target as HTMLInputElement).valueAsNumber)
              "
            />
          </div>
        </div>
      </div>

      <!-- SFX volume -->
      <div
        data-testid="sfx-volume"
        class="relative"
        @mouseenter="sfxPopoverOpen = true"
        @mouseleave="sfxPopoverOpen = false"
        @wheel="onSfxWheel"
      >
        <button class="btn btn-ghost btn-sm btn-square" :title="t('transport.sfxVolume')">
          <Icon icon="material-symbols:graphic-eq-rounded" class="h-5 w-5" />
        </button>
        <div
          v-show="sfxPopoverOpen"
          class="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded-md border border-base-300 bg-base-100 px-2 py-2 shadow-lg"
        >
          <div class="mb-1 text-center text-[10px] tabular-nums">
            {{ Math.round(store.project.audio.sfxVolume * 100) }}%
          </div>
          <div class="relative h-24 w-6">
            <input
              class="range range-xs absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-90"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="store.project.audio.sfxVolume"
              @input="
                store.setSfxVolume(($event.target as HTMLInputElement).valueAsNumber)
              "
            />
          </div>
        </div>
      </div>
    </section>
  </template>
  ```

- [ ] **Step 2: Run existing TransportBar tests**

  ```
  pnpm test:run "src/components/shell/TransportBar.spec.ts"
  ```
  Expected: all existing tests pass (the new controls use `v-if="timeline"` and since no timeline is provided in tests, they don't render — existing `data-testid` selectors still work).

- [ ] **Step 3: Add new tests to `src/components/shell/TransportBar.spec.ts`**

  Add after the existing tests:
  ```ts
  it('view-mode-toggle is not rendered without timeline context', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="view-mode-toggle"]').exists()).toBe(false)
  })

  it('subdivision-select is not rendered without timeline context', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="subdivision-select"]').exists()).toBe(false)
  })
  ```

- [ ] **Step 4: Run all TransportBar tests**

  ```
  pnpm test:run "src/components/shell/TransportBar.spec.ts"
  ```
  Expected: all pass.

- [ ] **Step 5: Commit**

  ```
  git add src/components/shell/TransportBar.vue src/components/shell/TransportBar.spec.ts
  git commit -m "feat(ui): add waveform/spectrogram toggle, subdivision and rhythm dropdowns to TransportBar

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 14: Wire AppShell.vue

**Files:**
- Modify: `src/components/shell/AppShell.vue`

### Background
AppShell:
1. Creates `timelineContainerRef` (a `shallowRef<HTMLElement | null>`)
2. Calls `useTimelineView(timelineContainerRef)` to get `timeline`
3. Provides `timeline` under `TIMELINE_VIEW_KEY` for TransportBar/MainView
4. Provides `timelineContainerRef` as `'timelineContainerRef'` for MainView to assign
5. Handles 4 new shortcut actions in `onAction`

- [ ] **Step 1: Rewrite `src/components/shell/AppShell.vue` `<script setup>`**

  ```vue
  <script setup lang="ts">
  import { onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'

  import { useEditorShortcuts } from '../../composables/useEditorShortcuts'
  import { useProjectPersistence } from '../../composables/useProjectPersistence'
  import {
    TIMELINE_VIEW_KEY,
    useTimelineView,
  } from '../../composables/useTimelineView'
  import { useEditorStore } from '../../stores/editor-store'
  import LyricsPanel from './LyricsPanel.vue'
  import MainView from './MainView.vue'
  import MenuBar from './MenuBar.vue'
  import TimingPointsPanel from './TimingPointsPanel.vue'
  import TransportBar from './TransportBar.vue'

  const store = useEditorStore()
  const persistence = useProjectPersistence()

  const editorMode = ref<'timing' | 'lyrics'>('timing')
  const theme = ref<'light' | 'dark'>('light')
  const followSystemTheme = ref(true)
  const audioInput = ref<HTMLInputElement | null>(null)

  // ---- Timeline view ----
  const timelineContainerRef = shallowRef<HTMLElement | null>(null)
  const timeline = useTimelineView(timelineContainerRef)

  provide(TIMELINE_VIEW_KEY, timeline)
  provide('timelineContainerRef', timelineContainerRef)

  // ---- Theme ----
  function detectSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function toggleTheme(): void {
    followSystemTheme.value = false
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  // ---- Audio file picker ----
  function openAudioPicker(): void {
    audioInput.value?.click()
  }

  async function onAudioSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    await store.importAudioFile(file)
    input.value = ''
  }

  // ---- System theme watcher ----
  let mediaQuery: MediaQueryList | null = null
  let mediaQueryHandler: ((event: MediaQueryListEvent) => void) | null = null

  onMounted(() => {
    theme.value = detectSystemTheme()
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQueryHandler = (event: MediaQueryListEvent) => {
      if (!followSystemTheme.value) return
      theme.value = event.matches ? 'dark' : 'light'
    }
    mediaQuery.addEventListener('change', mediaQueryHandler)
  })

  onBeforeUnmount(() => {
    if (mediaQuery && mediaQueryHandler) {
      mediaQuery.removeEventListener('change', mediaQueryHandler)
    }
  })

  watch(
    theme,
    (nextTheme) => {
      document.documentElement.setAttribute('data-theme', nextTheme)
    },
    { immediate: true },
  )

  // ---- Shortcuts ----
  useEditorShortcuts({
    onAction: async (action) => {
      if (action === 'history.undo') store.undo()
      else if (action === 'history.redo') store.redo()
      else if (action === 'project.save') await persistence.saveByShortcut()
      else if (action === 'transport.togglePlay') store.togglePlayback()
      else if (action === 'timing.tapBpm') store.tapBpm()
      else if (action === 'metronome.toggle') store.toggleMetronome()
      else if (action === 'transport.prevBeat')
        store.seekToPrevBeat(
          timeline.divisor.value,
          timeline.effectiveTriplets.value,
        )
      else if (action === 'transport.nextBeat')
        store.seekToNextBeat(
          timeline.divisor.value,
          timeline.effectiveTriplets.value,
        )
      else if (action === 'transport.prevBar') store.seekToPreviousBar()
      else if (action === 'transport.nextBar') store.seekToNextBar()
    },
  })
  </script>
  ```

  Keep the `<template>` section identical to before:
  ```vue
  <template>
    <div class="flex h-screen flex-col">
      <MenuBar
        data-testid="menu-bar"
        :mode="editorMode"
        :theme="theme"
        @switchMode="editorMode = $event"
        @toggleTheme="toggleTheme"
        @openAudioFile="openAudioPicker"
      />
      <input
        ref="audioInput"
        data-testid="audio-file-input"
        type="file"
        accept="audio/*"
        class="hidden"
        @change="onAudioSelected"
      />
      <MainView data-testid="main-view" />
      <TransportBar data-testid="transport-bar" />
      <TimingPointsPanel
        v-if="editorMode === 'timing'"
        data-testid="timing-points-panel"
      />
      <LyricsPanel v-else data-testid="lyrics-panel" />
    </div>
  </template>
  ```

- [ ] **Step 2: Run AppShell tests**

  ```
  pnpm test:run "src/components/shell/AppShell.spec.ts"
  ```
  Expected: all pass.

- [ ] **Step 3: Verify full test suite**

  ```
  pnpm test:run
  ```
  Expected: all tests pass. Fix any failures before committing.

- [ ] **Step 4: Commit**

  ```
  git add src/components/shell/AppShell.vue
  git commit -m "feat(shell): wire useTimelineView and new shortcuts in AppShell

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 15: Final verification

- [ ] **Step 1: Run full test suite**

  ```
  pnpm test:run
  ```
  Expected: all tests pass.

- [ ] **Step 2: Lint and format**

  ```
  pnpm lint && pnpm format
  ```
  Fix any issues, then run again to confirm clean.

- [ ] **Step 3: Type-check**

  ```
  pnpm check
  ```
  Expected: no errors.

- [ ] **Step 4: Build**

  ```
  pnpm build
  ```
  Expected: successful build, no type errors.

- [ ] **Step 5: Final commit**

  ```
  git add -A
  git commit -m "chore: lint and format Phase 3 implementation

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Spec Coverage Checklist

| Spec requirement | Covered by task |
|---|---|
| wavesurfer.js waveform rendering | Task 1, 10 |
| Spectrogram rendering (official plugin) | Task 10 |
| Waveform/spectrogram toggle button (left of metronome) | Task 13 |
| Vertical zoom slider in spectrogram mode | Task 12 |
| Custom WaveSurfer plugin for grid/playhead | Task 9 |
| getBeatGridLines pure function | Task 3 |
| Auto-center scroll during playback | Task 11 |
| Unified wheel semantics (normal=scroll, Ctrl=zoom, Shift=divisor) | Task 11, 12 |
| Subdivision dropdown (1x/2x/4x/8x/16x) | Task 13 |
| Rhythm mode dropdown (Common/Triplets) | Task 13 |
| Alt key = temporary triplets | Task 11 |
| Arrow shortcuts for beat/bar navigation | Task 7, 6, 14 |
| rhythmMode added to ProjectSettings | Task 2, 5, 6 |
| seekToNextBeat / seekToPrevBeat store actions | Task 4, 6 |
| Phase 4 word-timeline-bar-slot placeholder | Task 12 |
| zh-CN.json new keys | Task 8 |
