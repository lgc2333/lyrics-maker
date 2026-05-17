# Phase 2 Audio + Timing Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver phase-2 timing/audio core with timing points, TAP BPM, synchronized metronome (with latch rule), and separate music/SFX volume control.

**Architecture:** Keep all timing math in Vue-free `core/timing/*`, browser audio integration in `platform/audio/*`, and orchestration in `stores/editor-store.ts`. UI stays as thin composition surfaces (`components/shell/*` + new timing/audio feature components), and all project mutations continue through command objects to preserve undo/redo behavior.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Pinia, TypeScript, Vitest, Vue Test Utils, happy-dom, Web Audio API, HTMLAudioElement, pnpm.

---

## File Structure Map

- `src/core/domain/project.ts` — extend persisted domain with timing points and volume settings.
- `src/core/domain/project.spec.ts` — domain defaults and schema assertions.
- `src/core/commands/project-commands.ts` — add/update/remove timing point commands + setting update commands.
- `src/core/commands/project-commands.spec.ts` — command behavior coverage.
- `src/core/timing/timing-point.ts` — timing point type guards + sorting helpers.
- `src/core/timing/timing-engine.ts` — active segment resolution, pre-first-point backward projection, beat/bar calculations.
- `src/core/timing/timing-engine.spec.ts` — pure math behavior tests.
- `src/core/timing/tap-bpm.ts` — tap buffer and bpm estimate logic.
- `src/core/timing/tap-bpm.spec.ts` — tap threshold/reset behavior tests.
- `src/platform/audio/audio-transport.ts` — audio load/play/pause/currentTime/volume adapter.
- `src/platform/audio/audio-transport.spec.ts` — adapter tests with fake media element.
- `src/platform/audio/metronome.ts` — click scheduler, accent policy, latch handling, sfx volume, and bundled sample loading.
- `src/platform/audio/metronome.spec.ts` — schedule/stop/latch cancellation tests.
- `public/assets/metronome-tick-osu.wav` — metronome normal beat sample.
- `public/assets/metronome-tick-downbeat-osu.wav` — metronome downbeat sample.
- `public/assets/metronome-latch-osu.wav` — metronome latch tail sample.
- `src/stores/editor-store.ts` — phase-2 orchestration API and state.
- `src/stores/editor-store.spec.ts` — store behavior tests for timing/audio/tap/metronome/volume.
- `src/platform/shortcuts/registry.ts` — add phase-2 shortcut actions.
- `src/composables/useEditorShortcuts.ts` — register and dispatch `Space`, `B`, `M`.
- `src/components/shell/TransportBar.vue` — audio import, playback controls, current time, volume controls.
- `src/components/shell/ModePanel.vue` — render timing-mode controls and timing points list.
- `src/components/shell/AppShell.vue` — wire new shortcut actions to store.
- `src/components/shell/AppShell.spec.ts` — shell interaction coverage for phase-2 shortcuts.
- `src/platform/i18n/locales/zh-CN.ts` — phase-2 UI strings.
- `README.md` — update phase status and controls summary.

---

### Task 1: Extend Domain + Commands for Timing/Volume

**Files:**
- Modify: `src/core/domain/project.ts`
- Test: `src/core/domain/project.spec.ts`
- Modify: `src/core/commands/project-commands.ts`
- Create: `src/core/commands/project-commands.spec.ts`

- [ ] **Step 1: Write failing domain tests for timing points and volume defaults**

```ts
it('includes phase-2 timing and volume defaults', () => {
  const project = createEmptyProject()
  expect(project.timingPoints).toHaveLength(1)
  expect(project.timingPoints[0].time).toBe(0)
  expect(project.timingPoints[0].offsetMs).toBe(0)
  expect(project.audio.musicVolume).toBe(1)
  expect(project.audio.sfxVolume).toBe(0.8)
})
```

- [ ] **Step 2: Run domain test and verify it fails**

Run: `pnpm test:run src/core/domain/project.spec.ts`  
Expected: FAIL due to missing `timingPoints` / `audio` fields.

- [ ] **Step 3: Implement minimal domain changes**

```ts
export interface TimingPoint {
  id: string
  time: number
  bpm: number
  timeSignatureNumerator: number
  timeSignatureDenominator: number
  offsetMs: number
}
```

- [ ] **Step 4: Write failing command tests for add/update/remove timing points**

```ts
it('adds and removes timing points via commands', () => {
  const payload = {
    id: 'tp-2',
    time: 12,
    bpm: 150,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    offsetMs: 5,
  }
  const command = createAddTimingPointCommand(payload)
  const afterAdd = command.do(createEmptyProject())
  expect(afterAdd.timingPoints.some(p => p.id === 'tp-2')).toBe(true)
  const afterUndo = command.undo(afterAdd)
  expect(afterUndo.timingPoints.some(p => p.id === 'tp-2')).toBe(false)
})
```

- [ ] **Step 5: Run command tests and verify failure**

Run: `pnpm test:run src/core/commands/project-commands.spec.ts`  
Expected: FAIL due to missing command factories.

- [ ] **Step 6: Implement command factories**

```ts
createAddTimingPointCommand(payload: TimingPoint): Command<ProjectDocument>
createUpdateTimingPointCommand(id: string, patch: Partial<TimingPoint>): Command<ProjectDocument>
createRemoveTimingPointCommand(id: string): Command<ProjectDocument>
createSetAudioVolumeCommand(kind: 'music' | 'sfx', value: number): Command<ProjectDocument>
```

- [ ] **Step 7: Re-run tests**

Run: `pnpm test:run src/core/domain/project.spec.ts src/core/commands/project-commands.spec.ts`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/core/domain/project.ts src/core/domain/project.spec.ts src/core/commands/project-commands.ts src/core/commands/project-commands.spec.ts
git commit -m "feat: add phase2 domain and timing commands"
```

---

### Task 2: Build Timing Engine (Segment + Lead-in Backward Projection)

**Files:**
- Create: `src/core/timing/timing-point.ts`
- Create: `src/core/timing/timing-engine.ts`
- Test: `src/core/timing/timing-engine.spec.ts`

- [ ] **Step 1: Write failing tests for active timing point and lead-in behavior**

```ts
it('uses first timing point for times before first point by backward projection', () => {
  const points = [{
    id: 'tp-1',
    time: 10,
    bpm: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    offsetMs: 0,
  }]
  const beat = getBeatInfoAtTime(points, 9.5)
  expect(beat.pointId).toBe(points[0].id)
})
```

- [ ] **Step 2: Run timing engine tests and verify failure**

Run: `pnpm test:run src/core/timing/timing-engine.spec.ts`  
Expected: FAIL because timing engine module does not exist.

- [ ] **Step 3: Implement minimal timing helpers and engine**

```ts
export function getActiveTimingPoint(points: TimingPoint[], time: number): TimingPoint
export function getBeatInfoAtTime(points: TimingPoint[], time: number): BeatInfo
export function getNextBeatTime(points: TimingPoint[], time: number): number
```

- [ ] **Step 4: Re-run timing engine tests**

Run: `pnpm test:run src/core/timing/timing-engine.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/timing/timing-point.ts src/core/timing/timing-engine.ts src/core/timing/timing-engine.spec.ts
git commit -m "feat: add timing engine for segmented beat math"
```

---

### Task 3: Implement TAP BPM Estimator

**Files:**
- Create: `src/core/timing/tap-bpm.ts`
- Test: `src/core/timing/tap-bpm.spec.ts`

- [ ] **Step 1: Write failing tests for tap threshold and reset**

```ts
it('returns null before more than 8 taps', () => {
  const estimator = createTapBpmEstimator()
  for (let i = 0; i < 8; i++) estimator.push(i * 0.5)
  expect(estimator.push(8.0)).toBeNull()
})

it('returns bpm after 9th tap and resets on long gap', () => {
  const estimator = createTapBpmEstimator()
  for (let i = 0; i < 9; i++) estimator.push(i * 0.5)
  const estimate = estimator.push(4.5)
  expect(estimate?.bpm).toBeGreaterThan(100)
  estimator.push(8.0) // gap > 1s, should reset
  expect(estimator.push(8.5)).toBeNull()
})
```

- [ ] **Step 2: Run tap tests and verify failure**

Run: `pnpm test:run src/core/timing/tap-bpm.spec.ts`  
Expected: FAIL due to missing estimator.

- [ ] **Step 3: Implement estimator**

```ts
export interface TapEstimate { bpm: number; sampleCount: number }
export function createTapBpmEstimator(maxSamples = 128): {
  push: (timestampSeconds: number) => TapEstimate | null
  reset: () => void
}
```

- [ ] **Step 4: Re-run tap tests**

Run: `pnpm test:run src/core/timing/tap-bpm.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/timing/tap-bpm.ts src/core/timing/tap-bpm.spec.ts
git commit -m "feat: add tap bpm estimator for phase2 workflow"
```

---

### Task 4: Implement Audio Transport + Metronome (Latch Policy)

**Files:**
- Create: `src/platform/audio/audio-transport.ts`
- Test: `src/platform/audio/audio-transport.spec.ts`
- Create: `src/platform/audio/metronome.ts`
- Test: `src/platform/audio/metronome.spec.ts`
- Use: `public/assets/metronome-tick-osu.wav`, `public/assets/metronome-tick-downbeat-osu.wav`, `public/assets/metronome-latch-osu.wav`

- [ ] **Step 1: Write failing transport tests**

```ts
it('loads file and reports duration/currentTime/playing state', async () => {
  const transport = createAudioTransport(createFakeMediaElement())
  await transport.loadFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
  expect(transport.getDuration()).toBeGreaterThanOrEqual(0)
})

it('applies music volume independently', () => {
  const el = createFakeMediaElement()
  const transport = createAudioTransport(el)
  transport.setVolume(0.35)
  expect(el.volume).toBeCloseTo(0.35)
})
```

- [ ] **Step 2: Run transport tests and verify failure**

Run: `pnpm test:run src/platform/audio/audio-transport.spec.ts`  
Expected: FAIL with missing module.

- [ ] **Step 3: Implement transport adapter**

```ts
export interface AudioTransport {
  loadFile: (file: File) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  setVolume: (value: number) => void
}
```

- [ ] **Step 4: Write failing metronome tests for asset loading + accent/latch/cancel**

```ts
it('preloads bundled osu metronome samples from /assets', async () => {
  const fetchSpy = vi.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(8),
  }))
  const m = await createMetronome(createFakeAudioContext(), { fetchImpl: fetchSpy })
  expect(m.isReady()).toBe(true)
  expect(fetchSpy).toHaveBeenNthCalledWith(1, '/assets/metronome-tick-osu.wav')
  expect(fetchSpy).toHaveBeenNthCalledWith(2, '/assets/metronome-tick-downbeat-osu.wav')
  expect(fetchSpy).toHaveBeenNthCalledWith(3, '/assets/metronome-latch-osu.wav')
})

it('schedules accent on bar start and normal clicks otherwise', async () => {
  const m = await createMetronome(createFakeAudioContext())
  m.setEnabled(true)
  m.syncToTimeline(12, () => ({ at: 12.5, isBarStart: true }))
  expect(m.getPendingClickCount()).toBe(1)
})

it('on disable keeps current click, schedules one latch, then stops', async () => {
  const m = await createMetronome(createFakeAudioContext())
  m.setEnabled(true)
  m.setEnabled(false)
  expect(m.hasPendingLatch()).toBe(true)
})

it('cancels pending latch if re-enabled before latch time', async () => {
  const m = await createMetronome(createFakeAudioContext())
  m.setEnabled(false)
  m.setEnabled(true)
  expect(m.hasPendingLatch()).toBe(false)
})
```

- [ ] **Step 5: Run metronome tests and verify failure**

Run: `pnpm test:run src/platform/audio/metronome.spec.ts`  
Expected: FAIL with missing scheduler logic.

- [ ] **Step 6: Implement metronome scheduler (using bundled wav samples)**

```ts
const METRONOME_SAMPLE_PATHS = {
  tick: '/assets/metronome-tick-osu.wav',
  downbeat: '/assets/metronome-tick-downbeat-osu.wav',
  latch: '/assets/metronome-latch-osu.wav',
} as const

createMetronome(audioContext: AudioContext, deps?: { fetchImpl?: typeof fetch })
await metronome.preload()
metronome.setEnabled(enabled: boolean)
metronome.setSfxVolume(volume: number)
metronome.syncToTimeline(currentTime: number, getNextBeat: () => BeatInfo)
```

- [ ] **Step 7: Re-run platform audio tests**

Run: `pnpm test:run src/platform/audio/audio-transport.spec.ts src/platform/audio/metronome.spec.ts`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/platform/audio/audio-transport.ts src/platform/audio/audio-transport.spec.ts src/platform/audio/metronome.ts src/platform/audio/metronome.spec.ts
git commit -m "feat: add phase2 audio transport and metronome scheduler"
```

---

### Task 5: Wire Editor Store Orchestration

**Files:**
- Modify: `src/stores/editor-store.ts`
- Test: `src/stores/editor-store.spec.ts`

- [ ] **Step 1: Write failing store tests for phase-2 behavior**

```ts
it('applies tap bpm to active timing point after >8 taps', () => {
  const store = useEditorStore()
  for (let i = 0; i < 9; i++) store.tapBpm(i * 0.5)
  expect(store.project.timingPoints[0].bpm).toBeGreaterThan(100)
})

it('starts playback from active timing point when tapping while paused', () => {
  const store = useEditorStore()
  store.pausePlayback()
  store.tapBpm(1.0)
  expect(store.isPlaying).toBe(true)
})

it('updates musicVolume and sfxVolume independently', () => {
  const store = useEditorStore()
  store.setMusicVolume(0.2)
  store.setSfxVolume(0.7)
  expect(store.project.audio.musicVolume).toBe(0.2)
  expect(store.project.audio.sfxVolume).toBe(0.7)
})

it('disables metronome with latch behavior delegated to platform service', () => {
  const store = useEditorStore()
  store.toggleMetronome() // on
  store.toggleMetronome() // off
  expect(store.metronomeState).toBe('latch_pending')
})
```

- [ ] **Step 2: Run store tests and verify failure**

Run: `pnpm test:run src/stores/editor-store.spec.ts`  
Expected: FAIL due to missing store APIs/state.

- [ ] **Step 3: Implement store API**

```ts
importAudioFile(file: File)
togglePlayback()
pausePlayback()
tapBpm(sourceTime?: number)
addTimingPoint(input: Omit<TimingPoint, 'id'>)
updateTimingPoint(id: string, patch: Partial<TimingPoint>)
removeTimingPoint(id: string)
setMusicVolume(value: number)
setSfxVolume(value: number)
toggleMetronome()
```

- [ ] **Step 4: Re-run store tests**

Run: `pnpm test:run src/stores/editor-store.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/editor-store.ts src/stores/editor-store.spec.ts
git commit -m "feat: orchestrate phase2 timing and audio in editor store"
```

---

### Task 6: UI + Shortcut Integration (Functionality-first)

**Files:**
- Modify: `src/platform/shortcuts/registry.ts`
- Modify: `src/composables/useEditorShortcuts.ts`
- Modify: `src/components/shell/AppShell.vue`
- Modify: `src/components/shell/TransportBar.vue`
- Modify: `src/components/shell/ModePanel.vue`
- Test: `src/components/shell/AppShell.spec.ts`
- Modify: `src/platform/i18n/locales/zh-CN.ts`

- [ ] **Step 1: Write failing shell tests for phase-2 shortcuts**

```ts
it('dispatches Space/B/M to playback/tap/metronome actions', () => {
  const wrapper = mount(AppShell)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }))
  expect(wrapper.exists()).toBe(true)
})
```

- [ ] **Step 2: Run shell test and verify failure**

Run: `pnpm test:run src/components/shell/AppShell.spec.ts`  
Expected: FAIL because actions are not registered/wired.

- [ ] **Step 3: Implement shortcut actions and AppShell dispatch**

```ts
type ShortcutAction =
  | 'history.undo'
  | 'history.redo'
  | 'project.save'
  | 'transport.togglePlay'
  | 'timing.tapBpm'
  | 'metronome.toggle'
```

- [ ] **Step 4: Implement phase-2 controls in shell components**

```vue
<!-- TransportBar -->
<input type="file" accept="audio/*" />

<button>播放/暂停</button>

<input type="range" v-model="musicVolume" />

<input type="range" v-model="sfxVolume" />
```

- [ ] **Step 5: Re-run shell test**

Run: `pnpm test:run src/components/shell/AppShell.spec.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/shortcuts/registry.ts src/composables/useEditorShortcuts.ts src/components/shell/AppShell.vue src/components/shell/TransportBar.vue src/components/shell/ModePanel.vue src/components/shell/AppShell.spec.ts src/platform/i18n/locales/zh-CN.ts
git commit -m "feat: add phase2 shell controls and shortcut wiring"
```

---

### Task 7: Integration Pass + Project Checks + Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-16-lyrics-maker-phased-design.md` (already updated; keep consistent wording if code terms change)

- [ ] **Step 1: Run targeted tests in dependency order**

Run:  
`pnpm test:run src/core/domain/project.spec.ts src/core/commands/project-commands.spec.ts src/core/timing/timing-engine.spec.ts src/core/timing/tap-bpm.spec.ts src/platform/audio/audio-transport.spec.ts src/platform/audio/metronome.spec.ts src/stores/editor-store.spec.ts src/components/shell/AppShell.spec.ts`  
Expected: PASS.

- [ ] **Step 2: Run repo checks**

Run:  
`pnpm lint && pnpm check && pnpm test:run && pnpm build`  
Expected: all commands pass.

- [ ] **Step 3: Update README phase summary and control list**

```md
## Phase 2 (Audio + Timing Core)
- Audio import + transport controls
- Timing points with BPM/time signature/offset
- TAP BPM (button + B), >8 taps apply to active timing point
- Metronome synchronized with bar accent and latch tail rule
- Independent music and SFX volume controls
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-05-16-lyrics-maker-phased-design.md
git commit -m "docs: update phase2 scope and controls"
```

