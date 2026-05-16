# Phase 2 Post-Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Phase 2 的节拍器无声、TAP BPM 小数、`在此添加 Timing Point` 固定为 `0.0s`，并新增歌曲播放进度条（含拖动定位）。

**Architecture:** 根因是 `editor-store` 没有播放时钟驱动，`currentTime` 不随音频播放更新，导致 Timing Point 插入时间与节拍器调度都失效。修复方案保持三层边界：`core/timing` 负责时间与拍点计算，`platform/audio/metronome` 负责加载并播放 `/public/assets` 采样，`store` 负责 RAF 循环驱动与状态同步，`TransportBar` 只负责显示/交互进度条并调用 store action。

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Pinia, TypeScript, Vitest, Vue Test Utils, Web Audio API, HTMLAudioElement, pnpm

---

## 1) Root Cause & New Requirements

1. **`在此添加 Timing Point` 永远是 `0.0s`**
   - `ModePanel.vue` 用的是 `store.currentTime`。
   - `editor-store.ts` 从未在播放期间更新 `_currentTime`，所以值长期停留在初始化 `0`。
2. **节拍器按钮状态变化但无声**
   - `toggleMetronome()` 仅切换状态，没有播放循环定期调用 `metronome.syncToTimeline(...)`。
3. **TAP BPM 小数化**
   - `createTapBpmEstimator` 直接返回浮点 BPM（`60 / avgInterval`）。
4. **节拍器音效未接入**
   - `metronome.ts` 仍使用 `OscillatorNode`，未加载 `public/assets` 三个音效文件。
5. **新增需求：播放进度条**
   - 需要在 `TransportBar` 增加进度条，展示 `currentTime / duration`，并支持拖动 seek。

---

## 2) File Structure Map

- Modify: `src/core/timing/tap-bpm.ts`
- Modify: `src/core/timing/tap-bpm.spec.ts`
- Modify: `src/platform/audio/metronome.ts`
- Modify: `src/platform/audio/metronome.spec.ts`
- Modify: `src/stores/editor-store.ts`
- Modify: `src/stores/editor-store.spec.ts`
- Modify: `src/components/shell/TransportBar.vue`
- Create: `src/components/shell/TransportBar.spec.ts`
- Modify: `docs/superpowers/specs/2026-05-16-phase-2-audio-timing-design.md`

---

### Task 1: 先补失败测试（覆盖 4 个缺陷 + 进度条需求）

**Files:**
- Modify: `src/core/timing/tap-bpm.spec.ts`
- Modify: `src/stores/editor-store.spec.ts`
- Modify: `src/platform/audio/metronome.spec.ts`
- Create: `src/components/shell/TransportBar.spec.ts`

- [ ] **Step 1: TAP BPM 增加“整数输出”失败测试**

在 `src/core/timing/tap-bpm.spec.ts` 追加：

```ts
it('returns rounded integer bpm after estimate is available', () => {
  const estimator = createTapBpmEstimator()
  const taps = [0, 0.49, 0.99, 1.5, 2.01, 2.49, 2.98, 3.49, 3.99, 4.48]
  let estimate: ReturnType<typeof estimator.push> = null
  for (const t of taps) estimate = estimator.push(t)
  expect(estimate).not.toBeNull()
  expect(Number.isInteger(estimate!.bpm)).toBe(true)
})
```

- [ ] **Step 2: Store 增加“播放时 currentTime 会推进”失败测试**

在 `src/stores/editor-store.spec.ts` 的 audio transport describe 中追加：

```ts
it('updates currentTime while playback loop is running', async () => {
  vi.useFakeTimers()

  let now = 0
  const mock = createMockAudioTransport()
  mock.transport.getCurrentTime = vi.fn(() => {
    now += 0.25
    return now
  })
  __overrideAudioTransportFactory(() => mock.transport)

  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    setTimeout(() => cb(performance.now()), 0)
    return 1
  })
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})

  const store = useEditorStore()
  await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
  await store.togglePlayback()
  await vi.runOnlyPendingTimersAsync()

  expect(store.currentTime).toBeGreaterThan(0)
  vi.useRealTimers()
})
```

- [ ] **Step 3: Store 增加“播放后添加 Timing Point 使用当前时间”失败测试**

在 `src/stores/editor-store.spec.ts` 追加：

```ts
it('adds timing point at progressed currentTime instead of 0', async () => {
  vi.useFakeTimers()
  let now = 0
  const mock = createMockAudioTransport()
  mock.transport.getCurrentTime = vi.fn(() => {
    now += 0.5
    return now
  })
  __overrideAudioTransportFactory(() => mock.transport)

  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    setTimeout(() => cb(performance.now()), 0)
    return 2
  })
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})

  const store = useEditorStore()
  await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
  await store.togglePlayback()
  await vi.runOnlyPendingTimersAsync()

  store.addTimingPoint({
    time: store.currentTime,
    bpm: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    offsetMs: 0,
  })

  const inserted = store.project.timingPoints[store.project.timingPoints.length - 1]
  expect(inserted.time).toBeGreaterThan(0)
  vi.useRealTimers()
})
```

- [ ] **Step 4: Metronome 增加“加载 assets 三音效”失败测试**

在 `src/platform/audio/metronome.spec.ts` 追加：

```ts
it('loads three wav samples from /assets', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  }))
  vi.stubGlobal('fetch', fetchMock)

  const fakeCtx = {
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
    createBufferSource: () => ({ buffer: null, connect: vi.fn(), start: vi.fn() }),
    decodeAudioData: vi.fn(async () => ({}) as unknown as AudioBuffer),
  } as unknown as AudioContext

  createMetronome(fakeCtx)
  await Promise.resolve()
  await Promise.resolve()

  expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-tick-osu.wav')
  expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-tick-downbeat-osu.wav')
  expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-latch-osu.wav')
  vi.unstubAllGlobals()
})
```

- [ ] **Step 5: 新建进度条组件测试（失败）**

创建 `src/components/shell/TransportBar.spec.ts`：

```ts
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import TransportBar from './TransportBar.vue'
import { useEditorStore } from '../../stores/editor-store'

describe('TransportBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders playback progress slider', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="playback-progress"]').exists()).toBe(true)
  })

  it('binds slider value to store.currentTime', () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()
    expect(Number((wrapper.get('[data-testid="playback-progress"]').element as HTMLInputElement).value)).toBe(store.currentTime)
  })
})
```

- [ ] **Step 6: 运行失败测试确认红灯**

Run:
`pnpm test:run -- src/core/timing/tap-bpm.spec.ts src/stores/editor-store.spec.ts src/platform/audio/metronome.spec.ts src/components/shell/TransportBar.spec.ts`

Expected:
- `tap-bpm.spec.ts` 新整数断言失败
- `editor-store.spec.ts` 新 currentTime/插入时间断言失败
- `metronome.spec.ts` 新 assets 加载断言失败
- `TransportBar.spec.ts` 因缺少进度条控件失败

- [ ] **Step 7: Commit（仅测试变更）**

```bash
git add src/core/timing/tap-bpm.spec.ts src/stores/editor-store.spec.ts src/platform/audio/metronome.spec.ts src/components/shell/TransportBar.spec.ts
git commit -m "test: add regressions for playback time sync metronome assets and progress bar"
```

---

### Task 2: 修复 TAP BPM 小数（四舍五入）

**Files:**
- Modify: `src/core/timing/tap-bpm.ts`
- Test: `src/core/timing/tap-bpm.spec.ts`

- [ ] **Step 1: 修改 BPM 计算为四舍五入整数**

在 `src/core/timing/tap-bpm.ts` 中：

```ts
// before
const bpm = 60 / avgInterval

// after
const bpm = Math.round(60 / avgInterval)
```

- [ ] **Step 2: 运行 TAP 单测**

Run:
`pnpm test:run -- src/core/timing/tap-bpm.spec.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/timing/tap-bpm.ts
git commit -m "fix: round tap bpm estimate to integer"
```

---

### Task 3: Store 增加播放时钟循环（修复 currentTime 与 Timing Point 0.0s）

**Files:**
- Modify: `src/stores/editor-store.ts`
- Test: `src/stores/editor-store.spec.ts`

- [ ] **Step 1: 引入 timing-engine 拍点计算函数**

在 `editor-store.ts` import 修改为：

```ts
import {
  getActiveTimingPoint,
  getBeatInfoAtTime,
  getNextBeatTime,
} from '../core/timing/timing-engine'
```

- [ ] **Step 2: 增加 RAF 运行状态与播放循环**

在 store 内新增：

```ts
let _rafId: number | null = null

function _tickPlayback(): void {
  const transport = _audioTransport.value
  if (!transport || !transport.getIsPlaying()) {
    _rafId = null
    return
  }

  const now = transport.getCurrentTime()
  _currentTime.value = now

  const m = _metronome.value
  if (m && project.value.timingPoints.length > 0) {
    const nextAt = getNextBeatTime(project.value.timingPoints, now)
    const nextBeat = getBeatInfoAtTime(project.value.timingPoints, nextAt)
    m.syncToTimeline(now, { at: nextAt, isBarStart: nextBeat.isBarStart })

    if (_metronomeState.value === 'latch_pending' && !m.hasPendingLatch()) {
      _metronomeState.value = 'off'
    }
  }

  _rafId = requestAnimationFrame(_tickPlayback)
}

function _startPlaybackLoop(): void {
  if (_rafId !== null) return
  _rafId = requestAnimationFrame(_tickPlayback)
}

function _stopPlaybackLoop(): void {
  if (_rafId === null) return
  cancelAnimationFrame(_rafId)
  _rafId = null
}
```

- [ ] **Step 3: 在播放入口/出口接入循环**

修改 `togglePlayback` 与 `pausePlayback`：

```ts
if (transport.getIsPlaying()) {
  transport.pause()
  _stopPlaybackLoop()
} else {
  await transport.play()
  _startPlaybackLoop()
}
```

```ts
function pausePlayback(): void {
  _audioTransport.value?.pause()
  _stopPlaybackLoop()
}
```

- [ ] **Step 4: TAP 自动起播路径也启动循环**

在 `tapBpm()` 里 `await transport.play()` 后追加：

```ts
_startPlaybackLoop()
```

- [ ] **Step 5: 新增 duration/progress/seek API 给 UI 使用**

在 store 里新增：

```ts
const duration = computed(() => _audioTransport.value?.getDuration() ?? 0)
const progressRatio = computed(() =>
  duration.value > 0 ? Math.min(1, Math.max(0, _currentTime.value / duration.value)) : 0,
)

function seekPlayback(time: number): void {
  const transport = _audioTransport.value
  if (!transport) return
  const target = Math.max(0, Math.min(duration.value || 0, time))
  transport.seek(target)
  _currentTime.value = target
}
```

并在 return 导出：

```ts
duration,
progressRatio,
seekPlayback,
```

- [ ] **Step 6: 运行 store 单测**

Run:
`pnpm test:run -- src/stores/editor-store.spec.ts`

Expected: PASS（含 Task 1 新增用例）

- [ ] **Step 7: Commit**

```bash
git add src/stores/editor-store.ts src/stores/editor-store.spec.ts
git commit -m "fix: add playback loop to keep currentTime and timing point insertion in sync"
```

---

### Task 4: Metronome 接入 public/assets 三音效

**Files:**
- Modify: `src/platform/audio/metronome.ts`
- Test: `src/platform/audio/metronome.spec.ts`

- [ ] **Step 1: 在 createMetronome 初始化加载三个 WAV**

在 `metronome.ts` 增加：

```ts
let tickBuffer: AudioBuffer | null = null
let downbeatBuffer: AudioBuffer | null = null
let latchBuffer: AudioBuffer | null = null
let loadError: Error | null = null

async function loadBuffer(path: string): Promise<AudioBuffer> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Failed to fetch ${path}`)
  const raw = await response.arrayBuffer()
  return await audioContext.decodeAudioData(raw)
}

void Promise.all([
  loadBuffer('/assets/metronome-tick-osu.wav').then((b) => (tickBuffer = b)),
  loadBuffer('/assets/metronome-tick-downbeat-osu.wav').then((b) => (downbeatBuffer = b)),
  loadBuffer('/assets/metronome-latch-osu.wav').then((b) => (latchBuffer = b)),
]).catch((err) => {
  loadError = err instanceof Error ? err : new Error(String(err))
})
```

- [ ] **Step 2: 用 BufferSource 替代 Oscillator 发声**

新增：

```ts
function playBufferAt(at: number, buffer: AudioBuffer | null): void {
  if (destroyed || !buffer) return
  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.connect(masterGain)
  source.start(at)
}
```

`syncToTimeline` 中替换为：

```ts
if (loadError) return
if (!tickBuffer || !downbeatBuffer || !latchBuffer) return

if (enabled) {
  playBufferAt(audioCtxTime, nextBeat.isBarStart ? downbeatBuffer : tickBuffer)
  lastScheduledBeatTime = nextBeat.at
} else if (latchPending) {
  playBufferAt(audioCtxTime, latchBuffer)
  lastScheduledBeatTime = nextBeat.at
  latchPending = false
}
```

- [ ] **Step 3: 更新 metronome.spec 的 fake context**

把 fake context 从 `createOscillator` 断言改为 `createBufferSource` 断言：

```ts
createBufferSource() {
  const source = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
  }
  sources.push(source)
  return source
}
```

并校验：

```ts
expect(fakeCtx._sources.length).toBeGreaterThan(0)
expect(fakeCtx._sources[0].start).toHaveBeenCalled()
```

- [ ] **Step 4: 运行 metronome 单测**

Run:
`pnpm test:run -- src/platform/audio/metronome.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/platform/audio/metronome.ts src/platform/audio/metronome.spec.ts
git commit -m "feat: use public asset wav files for metronome tick downbeat and latch"
```

---

### Task 5: 新增 TransportBar 播放进度条（显示 + 拖动定位）

**Files:**
- Modify: `src/components/shell/TransportBar.vue`
- Test: `src/components/shell/TransportBar.spec.ts`

- [ ] **Step 1: 在 TransportBar 增加时间格式化函数**

在 `<script setup>` 添加：

```ts
function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00'
  const total = Math.floor(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function onSeek(event: Event) {
  const input = event.target as HTMLInputElement
  store.seekPlayback(input.valueAsNumber)
}
```

- [ ] **Step 2: 在模板添加进度条与时间显示**

在播放按钮后加入：

```vue
<div class="flex items-center gap-2 min-w-[320px]">
  <span class="text-xs tabular-nums">{{ formatTime(store.currentTime) }}</span>
  <input
    data-testid="playback-progress"
    type="range"
    min="0"
    :max="store.duration || 0"
    step="0.01"
    :value="store.currentTime"
    class="range range-xs w-56"
    :disabled="store.duration <= 0"
    @input="onSeek"
  />
  <span class="text-xs tabular-nums">{{ formatTime(store.duration) }}</span>
</div>
```

- [ ] **Step 3: 增加拖动 seek 行为测试**

在 `src/components/shell/TransportBar.spec.ts` 添加：

```ts
it('calls store.seekPlayback when slider input changes', async () => {
  const wrapper = mount(TransportBar)
  const store = useEditorStore()
  const spy = vi.spyOn(store, 'seekPlayback')
  const slider = wrapper.get('[data-testid="playback-progress"]')
  await slider.setValue(5)
  expect(spy).toHaveBeenCalled()
})
```

- [ ] **Step 4: 运行组件测试**

Run:
`pnpm test:run -- src/components/shell/TransportBar.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/TransportBar.vue src/components/shell/TransportBar.spec.ts
git commit -m "feat: add playback progress slider with seek support"
```

---

### Task 6: 文档同步（新增进度条与 Timing Point 时间修复）

**Files:**
- Modify: `docs/superpowers/specs/2026-05-16-phase-2-audio-timing-design.md`

- [ ] **Step 1: 在规格文档追加 Post-Hotfix 实现说明**

追加内容：

```md
实现备注（Post-Hotfix）：
- editor-store 在播放中通过 RAF 循环同步 currentTime
- “在此添加 Timing Point” 使用实时 currentTime，不再固定 0.0s
- TransportBar 新增播放进度条（展示 currentTime/duration，支持拖动 seek）
- Metronome 点击音源来自 /public/assets 三个 WAV 文件
- TAP BPM 写回 Timing Point 时四舍五入为整数
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-16-phase-2-audio-timing-design.md
git commit -m "docs: update phase2 post-hotfix notes for currentTime sync and progress bar"
```

---

### Task 7: 全量回归检查

**Files:**
- No file changes expected

- [ ] **Step 1: 运行针对性测试**

Run:
`pnpm test:run -- src/core/timing/tap-bpm.spec.ts src/stores/editor-store.spec.ts src/platform/audio/metronome.spec.ts src/components/shell/TransportBar.spec.ts`

Expected: PASS

- [ ] **Step 2: 运行仓库标准检查**

Run:
`pnpm lint && pnpm check && pnpm test:run && pnpm build`

Expected: 全部 PASS

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "fix: post-phase2 hotfix for playback time sync metronome assets and progress bar"
```

---

## 3) Non-Goals

- 不引入 Phase 3 网格密度切换、波形/频谱缩放功能
- 不改动命令历史栈设计
- 不新增快捷键重绑 UI

## 4) Risks

1. **RAF 循环测试不稳定**
   - 使用 `vi.useFakeTimers()` + mock `requestAnimationFrame` 保证确定性。
2. **WebAudio decode 在测试环境不完整**
   - `metronome.spec.ts` 使用 fake audio context + stub `decodeAudioData`。
3. **未加载音频前进度条行为**
   - 通过 `:disabled="store.duration <= 0"` 明确禁用 seek。

