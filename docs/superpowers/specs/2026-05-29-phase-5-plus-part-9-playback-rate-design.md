# Phase 5 Plus Part 9 — 播放速度控制设计

## 目标

在 TransportBar 中新增 25% / 50% / 75% / 100% 四档播放速度切换，session-only，不影响项目 timing 数据；接入快捷键架构（注册 actions，默认不绑定键位）。

## 范围

- 在 `TransportBar.vue` 中、`music-volume` 按钮左侧、`playback-progress` slider 右侧，内联一个 stepper：`-  100%  +`。
- 档位列表：`[0.25, 0.5, 0.75, 1]`，在 25% 时 `-` 按钮 disabled，在 100% 时 `+` 按钮 disabled。
- 播放速度仅在内存中保存（不写入 `LocalUserSettingsState`、不写入 `ProjectDocument`）；页面刷新前一直保留，导入新音频 / 切换项目都**不复位**。
- 数值仅显示百分比文本，**不变色、不加边框、不加 active 态**。
- 调整成功时 `StatusBar` 提示 `播放速度：xx%`（与 `setMusicVolume` 等现有风格一致）。
- 未加载音频时 stepper 仍然可用，可以预先调好。
- 注册三个新 `ShortcutAction`，默认未绑定（`null`）。

## 不在范围

- 不修改任何 timing/lyrics 数据。
- 不持久化播放速度。
- 不自动绑定默认快捷键键位。
- 不抽出公共 `JoinStepper` 组件（与 spec 无关的重构）。
- 不抽出独立子组件 `PlaybackRateStepper.vue`（与现有 `subdivision-stepper` 内联风格对齐）。

## 下游设施影响调研

**自动跟随的设施**（无需任何改动）：

- 歌词高亮、波形播放头、overlay 时间标记、进度滑块——全部读 `editor-store._currentTime`。`_tickPlayback` 每帧从 `audioElement.currentTime` 读最新值（`src/stores/editor-store.ts` 内 `_tickPlayback`）。当 `playbackRate=0.5`，`audioElement.currentTime` 推进自然减半，所有依赖 `_currentTime` 的 reactive watchers 自动跟着减慢，零额外逻辑。

**必须主动修正的设施 — Metronome**：

- `src/platform/audio/metronome.ts` 的 `scheduleLatchAtNextBeat` 与 `syncToTimeline` 的 schedule 公式当前形如：

  ```ts
  const audioCtxTime = audioContext.currentTime + (nextBeat.at - currentTime)
  ```

  把「歌曲时间差」（`nextBeat.at - currentTime`）直接加到「墙钟时间」（`audioContext.currentTime`）上。
- 在 `playbackRate=0.5` 时，墙钟要走 1 秒才走完 0.5 秒歌曲时间，但 click 仍按 0.5 秒墙钟 schedule → click 会提前响、且偏差随时间累积。
- 解决方案：`metronome` 新增 `setPlaybackRate(rate: number)`，内部维护 `playbackRate = 1`，schedule 公式统一改为：

  ```ts
  const audioCtxTime =
    audioContext.currentTime + (nextBeat.at - currentTime) / playbackRate
  ```

  调用 `setPlaybackRate(rate)` 时：取消尚未响的 `kind === 'beat'` clicks，并把 `lastScheduledBeatTime` 重置为 `-1`，让下一帧 `syncToTimeline` 用新 rate 重新 schedule。latch click 的折算公式同步更新，行为语义不变。

## 状态归属

- `editor-store` 新增 `_playbackRate: shallowRef<number>`，初始 `1`，session-only。
- 不读不写 `LocalUserSettingsState`、不读不写 `ProjectDocument`。
- `core/` 与 timing/lyrics 等 Vue-free 层不感知 `playbackRate`。
- timing 数据零变更，spec 验收要点「播放速度只影响音频播放，不改变项目 timing 数据」满足。

## Platform API

### `audio-transport.ts`

```ts
export interface AudioTransport {
  // ...既有方法
  setPlaybackRate: (rate: number) => void
  getPlaybackRate: () => number
}
```

- `setPlaybackRate(rate)`：仅校验 `rate > 0`；非正数抛 `Error`。合法值直接写入 `audioElement.playbackRate`，不做档位 snap、不做上下限 clamp（档位约束由 store 层负责）。
- `getPlaybackRate()`：返回 `audioElement.playbackRate`。

### `metronome.ts`

```ts
export interface MetronomeScheduler {
  // ...既有方法
  setPlaybackRate: (rate: number) => void
}
```

- 内部新增 `playbackRate = 1`。
- `syncToTimeline` 与 `scheduleLatchAtNextBeat` 中的 schedule 公式统一改用 `+(songTimeDelta) / playbackRate`。
- `setPlaybackRate(rate)`：仅校验 `rate > 0`，非正数抛 `Error`；更新内部 rate；取消所有尚未响的 `kind === 'beat'` clicks；`lastScheduledBeatTime = -1`。

## Store API

```ts
// editor-store.ts 顶部
const PLAYBACK_RATE_OPTIONS = [0.25, 0.5, 0.75, 1] as const
```

新增状态与 computed：

- `_playbackRate: shallowRef<number>`，初始 `1`。
- `playbackRate = computed(() => _playbackRate.value)`。
- `canIncreasePlaybackRate = computed(() => _playbackRate.value < 1)`。
- `canDecreasePlaybackRate = computed(() => _playbackRate.value > 0.25)`。

新增动作：

- `setPlaybackRate(rate: number)`：
  1. 仅校验 `rate > 0`（与 platform 守卫一致）；非正数抛 `Error`。
  2. 若 `rate === _playbackRate.value`，no-op 且**不发 status**（避免边界连按刷屏）。
  3. `_playbackRate.value = rate`。
  4. `_audioTransport.value?.setPlaybackRate(rate)`。
  5. `_metronome.value?.setPlaybackRate(rate)`。
  6. `showStatus('status.settings.playbackRate', { value: Math.round(rate * 100) })`。
- `increasePlaybackRate()`：在 `PLAYBACK_RATE_OPTIONS` 中找到下一档位，若存在则 `setPlaybackRate(nextRate)`，否则 no-op（已在 100% 上限）。
- `decreasePlaybackRate()`：对称（25% 下限时 no-op）。
- `resetPlaybackRate()`：`setPlaybackRate(1)`（已是 1 时 no-op）。

**与 `_syncAudioHardware` 集成**：

- `_syncAudioHardware` 扩展为同时下推：`audio-transport.setVolume` + `audio-transport.setPlaybackRate` + `metronome.setSfxVolume` + `metronome.setPlaybackRate`。
- `importAudioFile` 成功路径调用 `_syncAudioHardware()`（当前未调用，新增），保证新 audio 上 playbackRate 在 HTMLAudioElement `src` 变更后被重新 apply。

## UI（TransportBar 内联 stepper）

**位置**：插入在 `playback-progress` slider 和 `music-volume` `VerticalSliderPopover` 之间。

**模板**（仿 `subdivision-stepper` 内联风格）：

```vue
<div
  data-testid="playback-rate-stepper"
  class="join items-center"
  :title="t('transport.playbackRate')"
>
  <button
    data-testid="playback-rate-decrease"
    class="btn btn-sm btn-square join-item btn-ghost"
    :disabled="!store.canDecreasePlaybackRate"
    @click="store.decreasePlaybackRate()"
  >
    <Icon icon="material-symbols:remove-rounded" class="h-5 w-5" />
  </button>
  <div
    data-testid="playback-rate-value"
    class="join-item min-w-12 text-sm tabular-nums text-center"
  >
    {{ Math.round(store.playbackRate * 100) }}%
  </div>
  <button
    data-testid="playback-rate-increase"
    class="btn btn-sm btn-square join-item btn-ghost"
    :disabled="!store.canIncreasePlaybackRate"
    @click="store.increasePlaybackRate()"
  >
    <Icon icon="material-symbols:add-rounded" class="h-5 w-5" />
  </button>
</div>
```

**与 `subdivision-stepper` 的差异**：

- `min-w-12` 而非 `min-w-8`：容纳 `100%` 比 `16x` 略宽。
- 数值文本完整后缀 `%`，不像 subdivision 那样数字大字 / 单位小字（百分号语义上与数字一体）。
- 不带 `v-if="timeline"`：speed stepper 不依赖 timeline composable，未加载音频也可用。

## 快捷键架构接入

**`ShortcutAction` 联合类型扩展**（`src/platform/shortcuts/registry.ts`）：

```ts
export type ShortcutAction =
  | // ...既有
  | 'transport.increasePlaybackRate'
  | 'transport.decreasePlaybackRate'
  | 'transport.resetPlaybackRate'
```

**默认绑定**（`src/platform/shortcuts/defaults.ts`）：

```ts
'transport.increasePlaybackRate': null,
'transport.decreasePlaybackRate': null,
'transport.resetPlaybackRate': null,
```

`null` 表示「已注册但未绑定键位」，用户可在 `PreferencesModal` 中自行绑定（Part 8 已支持的能力，零额外 UI 改动）。

**Action dispatch**（`AppShell.vue` 的 `useEditorShortcuts({ onAction })` switch 表）：

```ts
case 'transport.increasePlaybackRate':
  store.increasePlaybackRate(); break
case 'transport.decreasePlaybackRate':
  store.decreasePlaybackRate(); break
case 'transport.resetPlaybackRate':
  store.resetPlaybackRate(); break
```

## i18n

`zh-CN.json` / `en-US.json` 同步新增：

```json
{
  "transport": {
    "playbackRate": "播放速度" / "Playback rate"
  },
  "status": {
    "settings": {
      "playbackRate": "播放速度：{value}%" / "Playback rate: {value}%"
    }
  },
  "shortcuts": {
    "actions": {
      "transport.increasePlaybackRate": "提高播放速度" / "Increase playback rate",
      "transport.decreasePlaybackRate": "降低播放速度" / "Decrease playback rate",
      "transport.resetPlaybackRate": "重置播放速度" / "Reset playback rate"
    }
  }
}
```

## 测试矩阵（TDD 路线）

### `src/platform/audio/audio-transport.spec.ts`

- `setPlaybackRate(0.5)` 写入 `audioElement.playbackRate === 0.5`。
- `setPlaybackRate(0)` / `setPlaybackRate(-1)` 抛 `Error`，且 `audioElement.playbackRate` 不变。
- `getPlaybackRate()` 反映当前值。

### `src/platform/audio/metronome.spec.ts`

- `setPlaybackRate(0.5)` 后 `syncToTimeline(currentTime=10, nextBeat={at:10.5})` → click 被 schedule 在 `audioContext.currentTime + 1.0`（而非 0.5）。
- `setPlaybackRate(0.5)` 后旧 `kind === 'beat'` clicks 被 cancel、`lastScheduledBeatTime` 归 -1；下一次 `syncToTimeline` 用新 rate 重 schedule。
- pause 后 `scheduleLatchAtNextBeat` 也按当前 rate 折算延时。
- `setPlaybackRate(0)` / `setPlaybackRate(-1)` 抛 `Error`，内部 rate 不变。

### `src/stores/editor-store.spec.ts`

- 初始 `playbackRate === 1`、`canIncreasePlaybackRate === false`、`canDecreasePlaybackRate === true`。
- `decreasePlaybackRate()` 序列：`1 → 0.75 → 0.5 → 0.25`；到 0.25 后再调用 no-op、不发 status。
- `increasePlaybackRate()` 对称：到 1 后 no-op。
- `resetPlaybackRate()` 从 0.5 回到 1，发 status；从 1 调用 no-op、不发 status。
- 每次成功变更调用 mock 的 `audioTransport.setPlaybackRate` + `metronome.setPlaybackRate`。
- `setPlaybackRate(0)` / `setPlaybackRate(-1)` 抛 `Error`。
- `importAudioFile` 成功后调用 `_syncAudioHardware` → mock 的 `audioTransport.setPlaybackRate` 被以当前 rate 调用。

### `src/components/shell/TransportBar.spec.ts`

- 渲染 `playback-rate-stepper`、`playback-rate-value` 文本为 `100%`。
- 初始时 `playback-rate-decrease` enabled、`playback-rate-increase` disabled。
- 点击 decrease 触发 `store.decreasePlaybackRate()`，数值更新为 `75%`。
- 未加载音频时 stepper 仍然渲染、按钮仍可点击。

### `src/components/shell/AppShell.spec.ts`（或现有 shortcuts 集成测试位置）

- 三个新 action 在 `onAction` switch 表里走对应 store 方法。
- `PreferencesModal` 列表中出现三个新 action 且默认未绑定（若有现成 spec）。

## 验收要点

- 调整播放速度后，timing 字段、bpm、bar 数等项目数据全部纹丝不动。
- `playbackRate=0.5` 时，节拍器 click 与 audio 实际节拍同步，不提前 / 不滞后。
- 25% 时 `-` 按钮 disabled；100% 时 `+` 按钮 disabled。
- 边界连按时不刷 `StatusBar`。
- 导入新音频后播放速度保持当前值（不复位）。
- 页面刷新后播放速度回到 100%（session-only 验证）。
- 未加载音频时 stepper 可用、操作不出错。
- 未绑定键位时三个 action 不会被触发；如果用户在 `PreferencesModal` 里绑定后，按键能改变速度。

## 涉及文件

- `src/platform/audio/audio-transport.ts`（+ `.spec.ts`）
- `src/platform/audio/metronome.ts`（+ `.spec.ts`）
- `src/stores/editor-store.ts`（+ `.spec.ts`）
- `src/components/shell/TransportBar.vue`（+ `.spec.ts`）
- `src/components/shell/AppShell.vue`（action dispatch；+ 若集成测试有则更新 `.spec.ts`）
- `src/platform/shortcuts/registry.ts`
- `src/platform/shortcuts/defaults.ts`
- `src/i18n/locales/zh-CN.json`
- `src/i18n/locales/en-US.json`
