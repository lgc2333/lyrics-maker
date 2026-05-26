# Timeline Wrapper Overlay Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move timeline grid and lyrics overlays into WaveSurfer's scroll coordinate system, split the playhead into a cheap viewport overlay, and keep playback follow smooth under high refresh-rate playback.

**Architecture:** `WaveSurferView` owns geometry helpers and scroll math. `GridOverlayPlugin` renders virtualized SVG content inside `wavesurfer.getWrapper()`, `LineOverlayPlugin` renders virtualized DOM lyric ranges inside the same wrapper, and a new `PlayheadOverlayPlugin` renders one fixed outer-container line updated by transform. `useTimelineView` separates playback-time updates from static overlay updates.

**Tech Stack:** TypeScript, Vue 3 Composition API, Pinia, Vitest + happy-dom, WaveSurfer v7 plugin API, SVG/DOM overlays.

---

## Research Notes

- WaveSurfer v7 renders into Shadow DOM and documents styling through CSS `::part(...)`; official plugins include Regions, Timeline, Envelope, and Spectrogram.
- Local `wavesurfer.js@7.12.7` source confirms:
  - `RegionsPlugin` appends `regionsContainer` to `wavesurfer.getWrapper()` and virtualizes region elements on `scroll`, `zoom`, and `resize`.
  - `TimelinePlugin` appends to `wavesurfer.getWrapper()` by default and virtualizes notches with `wavesurfer.getScroll()` / `wavesurfer.getWidth()`.
  - `EnvelopePlugin` creates an SVG attached to `wavesurfer.getWrapper()`.
  - Renderer `scrollIntoView(progress, isPlaying)` uses smooth playback catch-up: if playing and `pxPerSec <= 600`, it adds at most `10px`; otherwise it catches up by the full overflow.
- Current project state confirms:
  - `useTimelineView` updates grid and lyric overlays inside the `store.currentTime` watcher.
  - `GridOverlayPlugin` and `LineOverlayPlugin` append fixed canvases to the outer container.
  - `GridOverlayPlugin` currently draws the playhead and has a regression test for "no timing points still keeps playhead visible".
  - `WaveSurferView.scrollPlaybackTo()` hard-centers after the threshold instead of smooth catch-up.

## File Structure

- Modify `src/platform/waveform/wavesurfer-view.ts`
  - Add wrapper/scroll/geometry helpers.
  - Change playback scroll to smooth catch-up.
  - Keep explicit seek scroll behavior unchanged.
- Modify `src/platform/waveform/wavesurfer-view.spec.ts`
  - Cover helper geometry and smooth playback follow constants.
- Create `src/platform/waveform/playhead-overlay-plugin.ts`
  - Single fixed viewport playhead line attached to the outer container.
  - Cheap `update({ currentTime })` transform path.
- Create `src/platform/waveform/playhead-overlay-plugin.spec.ts`
  - Cover transform, no-timing-point visibility independence, and cleanup.
- Modify `src/platform/waveform/grid-overlay-plugin.ts`
  - Replace fixed canvas with wrapper-attached virtualized SVG grid.
  - Remove playhead rendering.
- Modify `src/platform/waveform/grid-overlay-plugin.spec.ts`
  - Replace canvas assertions with SVG/wrapper/virtualization assertions.
- Modify `src/platform/waveform/line-overlay-plugin.ts`
  - Replace fixed canvas with wrapper-attached virtualized DOM lyric overlay.
  - Preserve completed-line visual semantics.
- Modify `src/platform/waveform/line-overlay-plugin.spec.ts`
  - Replace canvas assertions with DOM rendering and virtualization assertions.
- Modify `src/composables/useTimelineView.ts`
  - Register the new playhead overlay.
  - Stop updating grid/lyrics from the current-time watcher.
  - Update playhead on current time, seek, ready, scroll, zoom, resize/redraw.
- Modify `src/composables/useTimelineView.spec.ts`
  - Cover hot-path separation and explicit seek behavior.
- Modify `docs/patterns/timeline-audio-lyrics.md`
  - Replace old fixed-canvas/playhead guidance with wrapper-attached overlay rules.

---

### Task 1: WaveSurfer Geometry Helpers And Smooth Playback Follow

**Files:**
- Modify: `src/platform/waveform/wavesurfer-view.ts`
- Test: `src/platform/waveform/wavesurfer-view.spec.ts`

- [ ] **Step 1: Read required skills and relevant docs**

Run:

```bash
Get-Content -Raw D:\Coding\lyrics-maker\.agents\skills\test-driven-development\SKILL.md
Get-Content -Raw D:\Coding\lyrics-maker\.agents\skills\systematic-debugging\SKILL.md
Get-Content -Raw docs\patterns\timeline-audio-lyrics.md
Get-Content -Raw docs\patterns\testing.md
```

Expected: confirm TDD requirements and existing timeline rules before editing.

- [ ] **Step 2: Add failing geometry helper tests**

In `src/platform/waveform/wavesurfer-view.spec.ts`, extend the `scrollTo` describe block with these tests:

```ts
it('exposes the WaveSurfer wrapper and scroll container', () => {
  const container = createContainer()
  const view = createWaveSurferView(container, defaultOptions)
  const wrapper = latestWs().getWrapper()

  expect(view.getWrapper()).toBe(wrapper)
  expect(view.getScrollContainer()).toBe(wrapper.parentElement)
})

it('returns pixels per second from wrapper width and duration', () => {
  const container = createContainer()
  const view = createWaveSurferView(container, defaultOptions)

  expect(view.getDuration()).toBe(120)
  expect(view.getPixelsPerSecond()).toBeCloseTo(13.333, 3)
})

it('returns the current visible time range and scroll geometry', () => {
  const container = createContainer()
  const view = createWaveSurferView(container, defaultOptions)
  const scrollEl = latestWs().getWrapper().parentElement!
  scrollEl.scrollLeft = 400

  expect(view.getVisibleRange()).toEqual({
    start: 30,
    end: 90,
    scrollLeft: 400,
    clientWidth: 800,
    scrollWidth: 1600,
  })
})
```

- [ ] **Step 3: Add failing smooth follow tests**

Replace the existing hard-centering playback test with these tests in `src/platform/waveform/wavesurfer-view.spec.ts`:

```ts
it('smoothly catches up by at most 10px at low zoom', () => {
  const container = createContainer()
  const view = createWaveSurferView(container, defaultOptions)
  const scrollEl = latestWs().getWrapper().parentElement!

  view.scrollPlaybackTo(31, 0.5)

  expect(scrollEl.scrollLeft).toBe(10)
})

it('uses full catch-up at high zoom', () => {
  const container = createContainer()
  const view = createWaveSurferView(container, defaultOptions)
  const wrapper = latestWs().getWrapper()
  Object.defineProperty(wrapper, 'scrollWidth', {
    value: 120000,
    configurable: true,
  })

  view.scrollPlaybackTo(1, 0.5)

  expect(scrollElFromLatestWs().scrollLeft).toBe(600)
})

function scrollElFromLatestWs(): HTMLElement {
  return latestWs().getWrapper().parentElement!
}
```

Keep the existing "left of threshold", "left of viewport", and "right of viewport" tests. Update the expected values for recentering tests only if the helper clamps based on the same center formula.

- [ ] **Step 4: Run tests to verify failure**

Run:

```bash
pnpm test:run "src/platform/waveform/wavesurfer-view.spec.ts"
```

Expected: FAIL because `getWrapper`, `getScrollContainer`, `getDuration`, `getPixelsPerSecond`, and `getVisibleRange` do not exist, and playback follow still hard-centers.

- [ ] **Step 5: Extend the WaveSurferView interface**

In `src/platform/waveform/wavesurfer-view.ts`, update `WaveSurferView`:

```ts
export interface TimelineVisibleRange {
  start: number
  end: number
  scrollLeft: number
  clientWidth: number
  scrollWidth: number
}

export interface WaveSurferView {
  registerPlugin: <T extends GenericPlugin>(plugin: T) => T
  loadBlob: (blob: Blob) => Promise<void>
  zoom: (pxPerSec: number, anchorClientX?: number) => void
  getWrapper: () => HTMLElement
  getScrollContainer: () => HTMLElement | null
  getDuration: () => number
  getPixelsPerSecond: () => number
  getVisibleRange: () => TimelineVisibleRange | null
  scrollTo: (time: number) => void
  scrollSeekTo: (time: number, marginRatio: number) => void
  scrollPlaybackTo: (time: number, thresholdRatio: number) => void
  scrollByDelta: (delta: number) => void
  getScrollTime: () => number
  setContainerHeight: (height: number) => void
  syncContainerHeight: (height: number) => Promise<void>
  on: (event: string, handler: (...args: unknown[]) => void) => () => void
  destroy: () => void
}
```

- [ ] **Step 6: Add helper implementations**

Inside `createWaveSurferView()`, replace `_getScrollContainer()` and add helpers:

```ts
function _getWrapper(): HTMLElement {
  return ws.getWrapper()
}

function _getScrollContainer(): HTMLElement | null {
  return _getWrapper().parentElement
}

function _getDuration(): number {
  return ws.getDuration()
}

function _getPixelsPerSecond(): number {
  const duration = _getDuration()
  if (duration <= 0) return 0
  return _getWrapper().scrollWidth / duration
}

function _getVisibleRange(): TimelineVisibleRange | null {
  const scrollEl = _getScrollContainer()
  const pxPerSec = _getPixelsPerSecond()
  if (!scrollEl || pxPerSec <= 0) return null

  return {
    start: scrollEl.scrollLeft / pxPerSec,
    end: (scrollEl.scrollLeft + scrollEl.clientWidth) / pxPerSec,
    scrollLeft: scrollEl.scrollLeft,
    clientWidth: scrollEl.clientWidth,
    scrollWidth: scrollEl.scrollWidth,
  }
}
```

In the returned object, add:

```ts
getWrapper: _getWrapper,
getScrollContainer: _getScrollContainer,
getDuration: _getDuration,
getPixelsPerSecond: _getPixelsPerSecond,
getVisibleRange: _getVisibleRange,
```

- [ ] **Step 7: Implement smooth playback follow**

Replace `scrollPlaybackTo()` in `src/platform/waveform/wavesurfer-view.ts`:

```ts
scrollPlaybackTo(time: number, thresholdRatio: number): void {
  const scrollEl = _getScrollContainer()
  if (!scrollEl) return
  const pxPerSec = _getPixelsPerSecond()
  if (pxPerSec <= 0) return

  const targetX = time * pxPerSec
  const playheadX = targetX - scrollEl.scrollLeft
  const isBeforeViewport = playheadX < 0
  const isAfterViewport = playheadX > scrollEl.clientWidth

  if (isBeforeViewport || isAfterViewport) {
    scrollEl.scrollLeft = Math.max(0, targetX - scrollEl.clientWidth / 2)
    return
  }

  const threshold = scrollEl.clientWidth * thresholdRatio
  const overflow = playheadX - threshold
  if (overflow <= 0) return

  const delta = pxPerSec <= 600 ? Math.min(overflow, 10) : overflow
  scrollEl.scrollLeft += delta
},
```

- [ ] **Step 8: Refactor existing geometry callers**

In `scrollTo`, `scrollSeekTo`, `getScrollTime`, and `zoom`, replace repeated `ws.getWrapper().scrollWidth / duration` math with `_getPixelsPerSecond()` where it keeps behavior identical. Keep `scrollSeekTo(time, 0.1)` semantics unchanged.

- [ ] **Step 9: Run targeted tests**

Run:

```bash
pnpm test:run "src/platform/waveform/wavesurfer-view.spec.ts"
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/platform/waveform/wavesurfer-view.ts src/platform/waveform/wavesurfer-view.spec.ts
git commit -m "fix: smooth timeline playback follow"
```

Expected: commit succeeds.

---

### Task 2: Dedicated Playhead Overlay Plugin

**Files:**
- Create: `src/platform/waveform/playhead-overlay-plugin.ts`
- Create: `src/platform/waveform/playhead-overlay-plugin.spec.ts`

- [ ] **Step 1: Write failing plugin tests**

Create `src/platform/waveform/playhead-overlay-plugin.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlayheadOverlayPlugin } from './playhead-overlay-plugin'

function createFakeWs(duration = 10) {
  const outerContainer = document.createElement('div')
  Object.defineProperty(outerContainer, 'clientHeight', { value: 200 })
  const scrollContainer = document.createElement('div')
  Object.defineProperty(scrollContainer, 'clientWidth', { value: 800 })
  Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1600 })
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'scrollWidth', { value: 1600 })
  scrollContainer.appendChild(wrapper)
  outerContainer.appendChild(scrollContainer)

  return {
    outerContainer,
    scrollContainer,
    wrapper,
    ws: {
      getWrapper: vi.fn(() => wrapper),
      getDuration: vi.fn(() => duration),
      on: vi.fn(() => vi.fn()),
    },
  }
}

describe('playheadOverlayPlugin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appends a viewport-fixed playhead to the outer container', () => {
    const { outerContainer, ws } = createFakeWs()
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })

    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    const line = outerContainer.querySelector('[data-testid="timeline-playhead"]')
    expect(line).toBeInstanceOf(HTMLDivElement)
    expect((line as HTMLElement).style.position).toBe('absolute')
    expect((line as HTMLElement).style.pointerEvents).toBe('none')
  })

  it('updates viewport x with transform from current time and scrollLeft', () => {
    const { outerContainer, scrollContainer, ws } = createFakeWs()
    scrollContainer.scrollLeft = 200
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    plugin.update({ currentTime: 2 })

    const line = outerContainer.querySelector('[data-testid="timeline-playhead"]') as HTMLElement
    expect(line.style.transform).toBe('translateX(120px)')
    expect(line.style.display).toBe('block')
  })

  it('remains independent of timing points', () => {
    const { outerContainer, ws } = createFakeWs()
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    expect(() => plugin.update({ currentTime: 1 })).not.toThrow()
    expect(outerContainer.querySelector('[data-testid="timeline-playhead"]')).not.toBeNull()
  })

  it('hides when duration is invalid', () => {
    const { outerContainer, ws } = createFakeWs(0)
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    plugin.update({ currentTime: 1 })

    const line = outerContainer.querySelector('[data-testid="timeline-playhead"]') as HTMLElement
    expect(line.style.display).toBe('none')
  })

  it('removes DOM on destroy', () => {
    const { outerContainer, ws } = createFakeWs()
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    plugin.destroy()

    expect(outerContainer.querySelector('[data-testid="timeline-playhead"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test:run "src/platform/waveform/playhead-overlay-plugin.spec.ts"
```

Expected: FAIL because the plugin file does not exist.

- [ ] **Step 3: Implement the playhead plugin**

Create `src/platform/waveform/playhead-overlay-plugin.ts`:

```ts
import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

export interface PlayheadOverlayOptions {
  outerContainer?: HTMLElement
}

export interface PlayheadOverlayParams {
  currentTime: number
}

export class PlayheadOverlayPlugin extends BasePlugin<
  BasePluginEvents,
  PlayheadOverlayOptions
> {
  private line: HTMLDivElement | null = null
  private currentTime = 0

  static create(options?: PlayheadOverlayOptions): PlayheadOverlayPlugin {
    return new PlayheadOverlayPlugin(options ?? {})
  }

  protected onInit(): void {
    const ws = this.wavesurfer!
    const wrapper = ws.getWrapper()
    const containerEl: HTMLElement =
      this.options.outerContainer ??
      (() => {
        const root = wrapper.getRootNode()
        const host = (root as ShadowRoot).host
        return (host as HTMLElement | undefined) ?? wrapper
      })()

    this.line = document.createElement('div')
    this.line.dataset.testid = 'timeline-playhead'
    Object.assign(this.line.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '2px',
      height: '100%',
      background: 'rgba(255,50,50,0.9)',
      pointerEvents: 'none',
      zIndex: '5',
      transform: 'translateX(-9999px)',
      willChange: 'transform',
    })

    containerEl.style.position = 'relative'
    containerEl.appendChild(this.line)

    this.subscriptions.push(
      ws.on('scroll', () => this._position()),
      ws.on('zoom', () => this._position()),
      ws.on('ready', () => this._position()),
      ws.on('redraw', () => this._position()),
      ws.on('resize', () => this._position()),
    )
  }

  update(params: PlayheadOverlayParams): void {
    this.currentTime = params.currentTime
    this._position()
  }

  private _position(): void {
    if (!this.line || !this.wavesurfer) return

    const duration = this.wavesurfer.getDuration()
    const wrapper = this.wavesurfer.getWrapper()
    const scrollContainer = wrapper.parentElement
    if (!scrollContainer || duration <= 0 || wrapper.scrollWidth <= 0) {
      this.line.style.display = 'none'
      return
    }

    const pxPerSec = wrapper.scrollWidth / duration
    const x = this.currentTime * pxPerSec - scrollContainer.scrollLeft
    const buffer = 4
    if (x < -buffer || x > scrollContainer.clientWidth + buffer) {
      this.line.style.display = 'none'
      this.line.style.transform = `translateX(${Math.round(x)}px)`
      return
    }

    this.line.style.display = 'block'
    this.line.style.transform = `translateX(${Math.round(x)}px)`
  }

  destroy(): void {
    this.line?.remove()
    this.line = null
    super.destroy()
  }
}
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
pnpm test:run "src/platform/waveform/playhead-overlay-plugin.spec.ts"
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/platform/waveform/playhead-overlay-plugin.ts src/platform/waveform/playhead-overlay-plugin.spec.ts
git commit -m "feat: split timeline playhead overlay"
```

Expected: commit succeeds.

---

### Task 3: Wire Playhead And Remove Current-Time Overlay Hot Path

**Files:**
- Modify: `src/composables/useTimelineView.ts`
- Test: `src/composables/useTimelineView.spec.ts`

- [ ] **Step 1: Update test mocks for the new plugin**

In `src/composables/useTimelineView.spec.ts`, add plugin module mocks before the tests:

```ts
const mockGridPlugins: Array<{ update: ReturnType<typeof vi.fn> }> = []
const mockLinePlugins: Array<{ update: ReturnType<typeof vi.fn> }> = []
const mockPlayheadPlugins: Array<{ update: ReturnType<typeof vi.fn> }> = []

vi.mock('../platform/waveform/grid-overlay-plugin', () => ({
  GridOverlayPlugin: {
    create: vi.fn(() => {
      const plugin = { update: vi.fn() }
      mockGridPlugins.push(plugin)
      return plugin
    }),
  },
}))

vi.mock('../platform/waveform/line-overlay-plugin', () => ({
  LineOverlayPlugin: {
    create: vi.fn(() => {
      const plugin = { update: vi.fn() }
      mockLinePlugins.push(plugin)
      return plugin
    }),
  },
}))

vi.mock('../platform/waveform/playhead-overlay-plugin', () => ({
  PlayheadOverlayPlugin: {
    create: vi.fn(() => {
      const plugin = { update: vi.fn() }
      mockPlayheadPlugins.push(plugin)
      return plugin
    }),
  },
}))
```

In `beforeEach`, clear these arrays:

```ts
mockGridPlugins.length = 0
mockLinePlugins.length = 0
mockPlayheadPlugins.length = 0
```

- [ ] **Step 2: Add failing hot-path separation test**

Add this test to `src/composables/useTimelineView.spec.ts`:

```ts
it('currentTime updates only move the playhead and playback follow', async () => {
  const container = document.createElement('div')
  const containerRef = shallowRef<HTMLElement | null>(container)
  const wrapper = mountHarness(() => {
    useTimelineView(containerRef)
  })
  const store = useEditorStore()
  await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
  await store.togglePlayback()

  mockGridPlugins[0].update.mockClear()
  mockLinePlugins[0].update.mockClear()
  mockPlayheadPlugins[0].update.mockClear()

  store.seekPlayback(8)
  await wrapper.vm.$nextTick()

  expect(mockPlayheadPlugins[0].update).toHaveBeenCalledWith({ currentTime: 8 })
  expect(mockViews[0].scrollPlaybackTo).toHaveBeenCalledWith(8, 0.5)
  expect(mockGridPlugins[0].update).not.toHaveBeenCalled()
  expect(mockLinePlugins[0].update).not.toHaveBeenCalled()

  wrapper.unmount()
})
```

- [ ] **Step 3: Add failing seek playhead update test**

Add:

```ts
it('explicit seek scroll also refreshes the playhead', async () => {
  const container = document.createElement('div')
  const containerRef = shallowRef<HTMLElement | null>(container)
  const wrapper = mountHarness(() => {
    useTimelineView(containerRef)
  })
  const store = useEditorStore()
  await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

  mockPlayheadPlugins[0].update.mockClear()
  store.seekPlayback(5)
  await wrapper.vm.$nextTick()

  expect(mockViews[0].scrollSeekTo).toHaveBeenCalledWith(5, 0.1)
  expect(mockPlayheadPlugins[0].update).toHaveBeenCalledWith({ currentTime: 5 })

  wrapper.unmount()
})
```

- [ ] **Step 4: Run tests to verify failure**

Run:

```bash
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: FAIL because no playhead plugin is registered and `currentTime` still updates grid/line overlays.

- [ ] **Step 5: Wire playhead plugin**

In `src/composables/useTimelineView.ts`, import and store the plugin:

```ts
import { PlayheadOverlayPlugin } from '../platform/waveform/playhead-overlay-plugin'
```

Add local variable:

```ts
let playheadPlugin: PlayheadOverlayPlugin | null = null
```

Add builder:

```ts
function _buildPlayheadParams() {
  return {
    currentTime: store.currentTime,
  }
}
```

In `_initWaveSurfer()`, after line overlay registration:

```ts
playheadPlugin = view.registerPlugin(
  PlayheadOverlayPlugin.create({ outerContainer: container }),
)
```

- [ ] **Step 6: Update ready and current-time data flow**

In the `ready` handler, add:

```ts
playheadPlugin?.update(_buildPlayheadParams())
```

Replace the `store.currentTime` watcher body with:

```ts
(t) => {
  playheadPlugin?.update({ currentTime: t })
  if (
    autoFollowPlayback.value &&
    store.isPlaying &&
    Date.now() - lastUserScrollAt > USER_SCROLL_COOLDOWN_MS
  ) {
    wavesurferView?.scrollPlaybackTo(t, PLAYBACK_FOLLOW_THRESHOLD_RATIO)
  }
},
```

In the `seekRequest.version` watcher, after `scrollSeekTo`:

```ts
playheadPlugin?.update(_buildPlayheadParams())
```

In cleanup and `setViewMode()`, null the plugin:

```ts
playheadPlugin = null
```

- [ ] **Step 7: Keep grid and lyrics reactive only to static changes**

In the timing-points watcher, remove `lineOverlayPlugin?.update(...)` so timing changes update grid only:

```ts
gridPlugin?.update(_buildOverlayParams())
```

Keep the lyrics watcher updating `lineOverlayPlugin`.

- [ ] **Step 8: Run targeted tests**

Run:

```bash
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/composables/useTimelineView.ts src/composables/useTimelineView.spec.ts
git commit -m "fix: decouple timeline overlays from playback ticks"
```

Expected: commit succeeds.

---

### Task 4: Wrapper-Attached Virtualized SVG Grid

**Files:**
- Modify: `src/platform/waveform/grid-overlay-plugin.ts`
- Test: `src/platform/waveform/grid-overlay-plugin.spec.ts`

- [ ] **Step 1: Replace canvas tests with SVG attachment tests**

In `src/platform/waveform/grid-overlay-plugin.spec.ts`, replace canvas-specific tests with helper and tests like:

```ts
function createFakeWs(duration = 10) {
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'scrollWidth', { value: 1000, configurable: true })
  Object.defineProperty(wrapper, 'clientHeight', { value: 200, configurable: true })
  const scrollContainer = document.createElement('div')
  Object.defineProperty(scrollContainer, 'clientWidth', { value: 500, configurable: true })
  Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1000, configurable: true })
  scrollContainer.appendChild(wrapper)
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  return {
    wrapper,
    scrollContainer,
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners[event] ?? []) fn(...args)
    },
    ws: {
      getWrapper: vi.fn(() => wrapper),
      getDuration: vi.fn(() => duration),
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        ;(listeners[event] ??= []).push(fn)
        return () => {}
      }),
    },
  }
}

const timingPoints: TimingPoint[] = [
  {
    id: 'tp-1',
    time: 0,
    bpm: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
  },
]

it('appends an svg grid layer to the WaveSurfer wrapper', () => {
  const { wrapper, ws } = createFakeWs()
  const plugin = GridOverlayPlugin.create()
  Reflect.set(plugin, 'wavesurfer', ws)
  Reflect.get(plugin, 'onInit').call(plugin)

  const svg = wrapper.querySelector('svg[data-testid="timeline-grid"]')
  expect(svg).toBeInstanceOf(SVGSVGElement)
  expect((svg as SVGSVGElement).style.position).toBe('absolute')
  expect((svg as SVGSVGElement).style.pointerEvents).toBe('none')
})

it('renders only buffered visible grid lines', () => {
  const { wrapper, ws } = createFakeWs()
  const plugin = GridOverlayPlugin.create()
  Reflect.set(plugin, 'wavesurfer', ws)
  Reflect.get(plugin, 'onInit').call(plugin)

  plugin.update({ timingPoints, divisor: 4, triplets: false })

  const lines = wrapper.querySelectorAll('line')
  expect(lines.length).toBeGreaterThan(0)
  for (const line of lines) {
    const x = Number(line.getAttribute('x1'))
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThanOrEqual(550)
  }
})

it('clears lines when timing points become empty', () => {
  const { wrapper, ws } = createFakeWs()
  const plugin = GridOverlayPlugin.create()
  Reflect.set(plugin, 'wavesurfer', ws)
  Reflect.get(plugin, 'onInit').call(plugin)

  plugin.update({ timingPoints, divisor: 4, triplets: false })
  expect(wrapper.querySelectorAll('line').length).toBeGreaterThan(0)

  plugin.update({ timingPoints: [], divisor: 4, triplets: false })
  expect(wrapper.querySelectorAll('line')).toHaveLength(0)
})

it('ignores current time in grid update params', () => {
  const plugin = GridOverlayPlugin.create()
  expect(() =>
    plugin.update({ timingPoints: [], divisor: 4, triplets: false }),
  ).not.toThrow()
})
```

Update `GridOverlayParams` test usages so `currentTime` is no longer passed.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test:run "src/platform/waveform/grid-overlay-plugin.spec.ts"
```

Expected: FAIL because the implementation still creates a canvas and still requires `currentTime`.

- [ ] **Step 3: Update grid params and fields**

In `src/platform/waveform/grid-overlay-plugin.ts`, change the params:

```ts
export interface GridOverlayParams {
  timingPoints: TimingPoint[]
  divisor: number
  triplets: boolean
}
```

Replace fields:

```ts
private svg: SVGSVGElement | null = null
private params: GridOverlayParams = {
  timingPoints: [],
  divisor: 4,
  triplets: false,
}
```

- [ ] **Step 4: Attach SVG to wrapper in onInit**

Replace canvas creation in `onInit()` with:

```ts
const wrapper = ws.getWrapper()
wrapper.style.position = 'relative'

this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
this.svg.dataset.testid = 'timeline-grid'
Object.assign(this.svg.style, {
  position: 'absolute',
  inset: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: '2',
})
wrapper.appendChild(this.svg)
```

Keep the existing scroll, zoom, ready, and redraw subscriptions, but have them call a new `_refreshVisibleRange()` before `_draw()`.

- [ ] **Step 5: Add visible range helper**

Add:

```ts
private _refreshVisibleRange(): void {
  if (!this.wavesurfer) return
  const wrapper = this.wavesurfer.getWrapper()
  const scrollContainer = wrapper.parentElement
  const duration = this.wavesurfer.getDuration()
  if (!scrollContainer || wrapper.scrollWidth <= 0 || duration <= 0) {
    this.visibleStart = 0
    this.visibleEnd = 0
    return
  }
  const pxPerSec = wrapper.scrollWidth / duration
  this.visibleStart = scrollContainer.scrollLeft / pxPerSec
  this.visibleEnd =
    (scrollContainer.scrollLeft + scrollContainer.clientWidth) / pxPerSec
}
```

Use this helper in `scroll`, `zoom`, `ready`, and `redraw`.

- [ ] **Step 6: Render virtualized SVG lines**

Replace `_draw()` with:

```ts
private _draw(): void {
  if (!this.svg || !this.wavesurfer) return

  this.svg.replaceChildren()

  const duration = this.wavesurfer.getDuration()
  if (duration <= 0) return

  const wrapper = this.wavesurfer.getWrapper()
  if (wrapper.scrollWidth <= 0) return

  const visibleDuration = this.visibleEnd - this.visibleStart
  if (visibleDuration <= 0) return

  if (this.params.timingPoints.length === 0) return

  const pxPerSec = wrapper.scrollWidth / duration
  const lines = getBeatGridLines(
    this.params.timingPoints,
    this.params.divisor,
    this.params.triplets,
    Math.max(0, this.visibleStart - 0.5),
    Math.min(duration, this.visibleEnd + 0.5),
  )

  for (const line of lines) {
    const x = line.time * pxPerSec
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    el.setAttribute('x1', `${x}`)
    el.setAttribute('x2', `${x}`)
    el.setAttribute('y1', '0')
    el.setAttribute('y2', '100%')

    if (line.type === 'bar') {
      el.setAttribute('stroke', 'rgba(255,255,255,0.8)')
      el.setAttribute('stroke-width', '2')
    } else if (line.type === 'beat') {
      el.setAttribute('stroke', 'rgba(255,255,255,0.5)')
      el.setAttribute('stroke-width', '1')
    } else {
      el.setAttribute('stroke', 'rgba(255,255,255,0.2)')
      el.setAttribute('stroke-width', '1')
    }

    this.svg.appendChild(el)
  }
}
```

- [ ] **Step 7: Update destroy**

Replace canvas cleanup:

```ts
destroy(): void {
  this.svg?.remove()
  this.svg = null
  super.destroy()
}
```

- [ ] **Step 8: Update composable grid params**

In `src/composables/useTimelineView.ts`, update `_buildOverlayParams()`:

```ts
function _buildOverlayParams() {
  return {
    timingPoints: store.project.timingPoints,
    divisor: divisor.value,
    triplets: effectiveTriplets.value,
  }
}
```

- [ ] **Step 9: Run targeted tests**

Run:

```bash
pnpm test:run "src/platform/waveform/grid-overlay-plugin.spec.ts" "src/composables/useTimelineView.spec.ts"
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/platform/waveform/grid-overlay-plugin.ts src/platform/waveform/grid-overlay-plugin.spec.ts src/composables/useTimelineView.ts src/composables/useTimelineView.spec.ts
git commit -m "feat: render timeline grid in wavesurfer wrapper"
```

Expected: commit succeeds.

---

### Task 5: Wrapper-Attached Virtualized Lyrics Overlay

**Files:**
- Modify: `src/platform/waveform/line-overlay-plugin.ts`
- Test: `src/platform/waveform/line-overlay-plugin.spec.ts`

- [ ] **Step 1: Replace canvas tests with DOM overlay tests**

In `src/platform/waveform/line-overlay-plugin.spec.ts`, replace canvas rendering tests with:

```ts
function createFakeWs(duration = 10) {
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'scrollWidth', { value: 1000, configurable: true })
  const scrollContainer = document.createElement('div')
  Object.defineProperty(scrollContainer, 'clientWidth', { value: 500, configurable: true })
  Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1000, configurable: true })
  scrollContainer.appendChild(wrapper)
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  return {
    wrapper,
    scrollContainer,
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners[event] ?? []) fn(...args)
    },
    ws: {
      getWrapper: vi.fn(() => wrapper),
      getDuration: vi.fn(() => duration),
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        ;(listeners[event] ??= []).push(fn)
        return () => {}
      }),
    },
  }
}

it('appends a lyrics layer to the WaveSurfer wrapper', () => {
  const { wrapper, ws } = createFakeWs()
  const plugin = LineOverlayPlugin.create()
  Reflect.set(plugin, 'wavesurfer', ws)
  Reflect.get(plugin, 'onInit').call(plugin)

  expect(wrapper.querySelector('[data-testid="timeline-lyrics"]')).toBeInstanceOf(HTMLDivElement)
})

it('renders a completed timed line with current visual semantics', () => {
  const { wrapper, ws } = createFakeWs()
  const plugin = LineOverlayPlugin.create()
  Reflect.set(plugin, 'wavesurfer', ws)
  Reflect.get(plugin, 'onInit').call(plugin)

  plugin.update({
    lyrics: [
      {
        id: 'line-1',
        startTime: 1,
        words: [
          { id: 'w1', text: 'hello ', endTime: 2 },
          { id: 'w2', text: 'world', endTime: 3 },
        ],
      },
    ],
    activeLineId: 'line-1',
  })

  expect(wrapper.querySelector('[data-testid="lyric-range-line-1"]')).not.toBeNull()
  expect(wrapper.querySelector('[data-testid="line-start-line-1"]')).not.toBeNull()
  expect(wrapper.querySelector('[data-testid="line-end-line-1"]')).not.toBeNull()
  expect(wrapper.querySelector('[data-testid="word-separator-w2"]')).not.toBeNull()
  expect(wrapper.querySelector('[data-testid="word-label-w1"]')?.textContent).toBe('hello')
})

it('skips untimed lines', () => {
  const { wrapper, ws } = createFakeWs()
  const plugin = LineOverlayPlugin.create()
  Reflect.set(plugin, 'wavesurfer', ws)
  Reflect.get(plugin, 'onInit').call(plugin)

  plugin.update({
    lyrics: [{ id: 'line-1', words: [{ id: 'w1', text: 'hello' }] }],
    activeLineId: null,
  })

  expect(wrapper.querySelector('[data-testid^="lyric-range-"]')).toBeNull()
})

it('virtualizes lines outside the buffered visible range', () => {
  const { wrapper, ws } = createFakeWs()
  const plugin = LineOverlayPlugin.create()
  Reflect.set(plugin, 'wavesurfer', ws)
  Reflect.get(plugin, 'onInit').call(plugin)

  plugin.update({
    lyrics: [
      {
        id: 'far-line',
        startTime: 8,
        words: [{ id: 'w1', text: 'later', endTime: 9 }],
      },
    ],
    activeLineId: null,
  })

  expect(wrapper.querySelector('[data-testid="lyric-range-far-line"]')).toBeNull()
})
```

Update `LineOverlayParams` usages so `currentTime` is no longer passed.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts"
```

Expected: FAIL because the implementation still creates a canvas and still expects `currentTime`.

- [ ] **Step 3: Update params and fields**

In `src/platform/waveform/line-overlay-plugin.ts`, change:

```ts
export interface LineOverlayParams {
  lyrics: LyricLine[]
  activeLineId: string | null
}
```

Replace canvas field:

```ts
private layer: HTMLDivElement | null = null
private params: LineOverlayParams = {
  lyrics: [],
  activeLineId: null,
}
```

- [ ] **Step 4: Attach DOM layer to wrapper**

In `onInit()`, replace canvas creation with:

```ts
const wrapper = ws.getWrapper()
wrapper.style.position = 'relative'

this.layer = document.createElement('div')
this.layer.dataset.testid = 'timeline-lyrics'
Object.assign(this.layer.style, {
  position: 'absolute',
  inset: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: '3',
  overflow: 'visible',
})
wrapper.appendChild(this.layer)
```

Add the same `_refreshVisibleRange()` pattern used by the grid plugin and call it from `scroll`, `zoom`, `ready`, and `redraw`.

- [ ] **Step 5: Add helper methods for DOM creation**

Add methods:

```ts
private _createBoundary(testId: string, leftPx: number, color: string, dashed = false): HTMLDivElement {
  const el = document.createElement('div')
  el.dataset.testid = testId
  Object.assign(el.style, {
    position: 'absolute',
    top: '0',
    left: `${leftPx}px`,
    width: '0',
    height: '100%',
    borderLeft: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
    pointerEvents: 'none',
  })
  return el
}

private _intersects(start: number, end: number): boolean {
  const buffer = 0.5
  return end >= this.visibleStart - buffer && start <= this.visibleEnd + buffer
}
```

- [ ] **Step 6: Render virtualized completed lyric lines**

Replace `_draw()` with:

```ts
private _draw(): void {
  if (!this.layer || !this.wavesurfer) return
  this.layer.replaceChildren()

  const duration = this.wavesurfer.getDuration()
  if (duration <= 0) return

  const wrapper = this.wavesurfer.getWrapper()
  if (wrapper.scrollWidth <= 0) return

  const visibleDuration = this.visibleEnd - this.visibleStart
  if (visibleDuration <= 0) return

  const pxPerSec = wrapper.scrollWidth / duration

  for (const line of this.params.lyrics) {
    if (line.startTime === undefined) continue
    const lastWord = line.words[line.words.length - 1]
    const lineEnd = lastWord?.endTime
    if (lineEnd === undefined) continue
    if (!this._intersects(line.startTime, lineEnd)) continue

    const isActive = line.id === this.params.activeLineId
    const x1 = line.startTime * pxPerSec
    const x2 = lineEnd * pxPerSec
    const range = document.createElement('div')
    range.dataset.testid = `lyric-range-${line.id}`
    Object.assign(range.style, {
      position: 'absolute',
      top: '0',
      left: `${x1}px`,
      width: `${Math.max(0, x2 - x1)}px`,
      height: '100%',
      background: isActive
        ? 'rgba(100, 180, 255, 0.12)'
        : 'rgba(100, 180, 255, 0.05)',
      pointerEvents: 'none',
    })

    range.appendChild(
      this._createBoundary(`line-start-${line.id}`, 0, 'rgba(255, 80, 80, 0.8)'),
    )
    range.appendChild(
      this._createBoundary(
        `line-end-${line.id}`,
        Math.max(0, x2 - x1),
        'rgba(100, 180, 255, 0.8)',
      ),
    )

    let prevWordEnd = line.startTime
    for (let i = 0; i < line.words.length; i++) {
      const word = line.words[i]
      const wordStart = prevWordEnd
      const wordEnd = word.endTime
      if (wordEnd === undefined) break

      const wordX1 = wordStart * pxPerSec - x1
      const wordX2 = wordEnd * pxPerSec - x1
      const wordWidth = wordX2 - wordX1

      if (i > 0) {
        range.appendChild(
          this._createBoundary(
            `word-separator-${word.id}`,
            wordX1,
            isActive ? 'rgba(255, 214, 80, 0.85)' : 'rgba(255, 214, 80, 0.45)',
            true,
          ),
        )
      }

      if (wordWidth > 8 && this._intersects(wordStart, wordEnd)) {
        const label = document.createElement('div')
        label.dataset.testid = `word-label-${word.id}`
        label.textContent = word.text.trimEnd()
        Object.assign(label.style, {
          position: 'absolute',
          top: '15%',
          left: `${wordX1}px`,
          width: `${wordWidth}px`,
          overflow: 'hidden',
          textOverflow: 'clip',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          fontSize: `${Math.max(10, Math.min(14, wordWidth * 0.6))}px`,
          color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
          textShadow: '0 0 2px rgba(0,0,0,0.7)',
        })
        range.appendChild(label)
      }

      prevWordEnd = wordEnd
    }

    this.layer.appendChild(range)
  }
}
```

- [ ] **Step 7: Update destroy**

Replace canvas cleanup:

```ts
destroy(): void {
  this.layer?.remove()
  this.layer = null
  super.destroy()
}
```

- [ ] **Step 8: Update composable line params**

In `src/composables/useTimelineView.ts`, update `_buildLineOverlayParams()`:

```ts
function _buildLineOverlayParams() {
  return {
    lyrics: store.project.lyrics,
    activeLineId: null as string | null,
  }
}
```

- [ ] **Step 9: Run targeted tests**

Run:

```bash
pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts" "src/composables/useTimelineView.spec.ts"
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/platform/waveform/line-overlay-plugin.ts src/platform/waveform/line-overlay-plugin.spec.ts src/composables/useTimelineView.ts src/composables/useTimelineView.spec.ts
git commit -m "feat: render lyrics overlay in wavesurfer wrapper"
```

Expected: commit succeeds.

---

### Task 6: Overlay Event Refresh And View Mode Regression Coverage

**Files:**
- Modify: `src/composables/useTimelineView.spec.ts`
- Modify: `src/composables/useTimelineView.ts`

- [ ] **Step 1: Add event-emitting WaveSurfer mock support**

In the `createWaveSurferView` mock in `src/composables/useTimelineView.spec.ts`, store listeners:

```ts
const mockViewListeners: Array<Record<string, Array<(...args: unknown[]) => void>>> = []

function emitViewEvent(index: number, event: string, ...args: unknown[]) {
  for (const fn of mockViewListeners[index]?.[event] ?? []) fn(...args)
}
```

Inside the mock factory:

```ts
const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
mockViewListeners.push(listeners)
```

Replace `on: vi.fn(() => () => {})` with:

```ts
on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
  ;(listeners[event] ??= []).push(fn)
  return () => {}
}),
```

Clear `mockViewListeners` in `beforeEach`.

- [ ] **Step 2: Add failing scroll/zoom/ready playhead refresh test**

Add:

```ts
it('refreshes playhead on WaveSurfer ready scroll zoom redraw and resize', async () => {
  const container = document.createElement('div')
  const containerRef = shallowRef<HTMLElement | null>(container)
  const wrapper = mountHarness(() => {
    useTimelineView(containerRef)
  })

  mockPlayheadPlugins[0].update.mockClear()

  emitViewEvent(0, 'ready')
  emitViewEvent(0, 'scroll')
  emitViewEvent(0, 'zoom')
  emitViewEvent(0, 'redraw')
  emitViewEvent(0, 'resize')
  await wrapper.vm.$nextTick()

  expect(mockPlayheadPlugins[0].update).toHaveBeenCalledTimes(5)

  wrapper.unmount()
})
```

- [ ] **Step 3: Add failing view mode cleanup test**

Add:

```ts
it('recreates the playhead plugin when switching view modes', async () => {
  let timeline: ReturnType<typeof useTimelineView> | undefined
  const container = document.createElement('div')
  const containerRef = shallowRef<HTMLElement | null>(container)
  const wrapper = mountHarness(() => {
    timeline = useTimelineView(containerRef)
  })

  expect(mockPlayheadPlugins).toHaveLength(1)
  timeline!.setViewMode('spectrogram')
  await wrapper.vm.$nextTick()

  expect(mockViews[0].destroy).toHaveBeenCalled()
  expect(mockPlayheadPlugins).toHaveLength(2)

  wrapper.unmount()
})
```

- [ ] **Step 4: Run tests to verify failure**

Run:

```bash
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: FAIL until events update the playhead and view-mode cleanup includes the playhead plugin.

- [ ] **Step 5: Add overlay refresh event wiring**

In `_initWaveSurfer()`, after the `ready` handler, add a shared callback:

```ts
const refreshPlayhead = () => {
  playheadPlugin?.update(_buildPlayheadParams())
}

view.on('scroll', refreshPlayhead)
view.on('zoom', refreshPlayhead)
view.on('redraw', refreshPlayhead)
view.on('resize', refreshPlayhead)
```

Do not update grid or lyrics here; their plugins already listen to WaveSurfer events and own their virtualized content refresh.

- [ ] **Step 6: Ensure cleanup nulls playhead**

Confirm both `onUnmounted()` and `setViewMode()` include:

```ts
playheadPlugin = null
```

- [ ] **Step 7: Run targeted tests**

Run:

```bash
pnpm test:run "src/composables/useTimelineView.spec.ts"
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/composables/useTimelineView.ts src/composables/useTimelineView.spec.ts
git commit -m "test: cover timeline overlay refresh events"
```

Expected: commit succeeds.

---

### Task 7: Pattern Documentation Update

**Files:**
- Modify: `docs/patterns/timeline-audio-lyrics.md`

- [ ] **Step 1: Update old fixed-canvas rules**

In `docs/patterns/timeline-audio-lyrics.md`, replace the first three WaveSurfer timeline bullets with:

```md
- **Timeline content overlays attach to `wavesurfer.getWrapper()`.** Grid and lyrics overlay content must live in WaveSurfer's wrapper coordinate system so browser scrolling carries it with the waveform/spectrogram. Keep viewport-fixed UI such as the playhead on the outer container.
- **Grid overlay is SVG and virtualized.** Generate beat/bar/subdivision lines only for the visible range plus a small buffer. Grid rendering must respond to timing point, divisor/triplet, ready, zoom, resize/redraw, and scroll changes, but not to playback `currentTime`.
- **Lyrics overlay is DOM and virtualized.** Render only timed lyric segments intersecting the visible range plus a small buffer. Preserve red line start, blue completed-line end, yellow dashed word separators, timed range fill, and trimmed word labels.
- **Playhead overlay is independent from timing points.** The playhead is a single outer-container DOM line updated with `transform: translateX(...)` from `currentTime`, `scrollLeft`, and pixels-per-second. Deleting the last timing point clears grid lines but must not hide the playhead.
- **WaveSurfer wrapper uses Shadow DOM.** `wavesurfer.getWrapper()` returns the internal wrapper element and its parent is the scroll container. Centralize repeated wrapper/scroll geometry in `WaveSurferView` helpers where possible.
```

Keep the existing spectrogram, seek scroll, audio, and lyrics timing rules unless they directly contradict the new overlay model.

- [ ] **Step 2: Run docs format**

Run:

```bash
pnpm format
```

Expected: Prettier completes and may rewrite markdown formatting.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/patterns/timeline-audio-lyrics.md
git commit -m "docs: update timeline overlay patterns"
```

Expected: commit succeeds.

---

### Task 8: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run targeted waveform and composable tests**

Run:

```bash
pnpm test:run "src/platform/waveform/wavesurfer-view.spec.ts" "src/platform/waveform/playhead-overlay-plugin.spec.ts" "src/platform/waveform/grid-overlay-plugin.spec.ts" "src/platform/waveform/line-overlay-plugin.spec.ts" "src/composables/useTimelineView.spec.ts"
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test:run
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run format**

Run:

```bash
pnpm format
```

Expected: PASS, with files formatted.

- [ ] **Step 5: Run type check**

Run:

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 6: Optional browser verification**

Run the dev server:

```bash
pnpm dev
```

Expected: Vite prints a local URL.

Manual checks:

- Playback auto-follow feels smooth at low zoom and does not jump-center every tick.
- Scrubbing/seeking still moves the visible timeline to the 10%-90% margin band.
- Waveform and spectrogram modes both show grid, lyric overlay, and playhead.
- Deleting the last timing point clears grid lines and keeps the playhead visible.
- Dense subdivisions on a long song do not create unbounded SVG line nodes.

- [ ] **Step 7: Commit final verification fixes if needed**

If verification required fixes, commit them:

```bash
git add src docs
git commit -m "fix: stabilize wrapper timeline overlays"
```

Expected: commit only if fixes were made after Task 7.

---

## Self-Review

- Spec coverage:
  - Smooth follow is covered by Task 1.
  - Playhead split is covered by Tasks 2, 3, and 6.
  - Wrapper-attached virtualized grid is covered by Task 4.
  - Wrapper-attached virtualized lyrics are covered by Task 5.
  - Current-time hot-path separation is covered by Task 3.
  - Explicit seek independence is preserved in Task 1 and tested in Task 3.
  - Pattern docs are covered by Task 7.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency:
  - `GridOverlayParams` removes `currentTime`.
  - `LineOverlayParams` removes `currentTime`.
  - `PlayheadOverlayParams` owns `currentTime`.
  - `WaveSurferView` geometry helpers match call sites in later tasks.
