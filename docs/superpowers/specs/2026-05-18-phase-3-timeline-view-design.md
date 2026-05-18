# Phase 3：主视图与网格系统设计

## 1. 背景与目标

Pre Phase 3 已完成页面框架和交互骨架（菜单、模式切换、TimingPointsPanel、可拖拽 MainView 占位容器）。  
Phase 3 在此基础上接入：

- 波形/频谱渲染（基于 wavesurfer.js）
- 自定义网格叠层插件（小节线、细分线、播放头）
- 时间轴自动滚动与缩放
- 细分档位与 Common/Triplets 节奏模式切换
- 频谱垂直缩放控件
- Phase 3 相关全局快捷键

## 2. 范围定义

### 2.1 本次实现（In Scope）

- 波形渲染（wavesurfer.js）
- 频谱渲染（wavesurfer.js 官方 Spectrogram 插件）
- TransportBar 波形/频谱切换按钮（节拍器左侧）
- 频谱模式下 MainView 右侧垂直缩放划条（参考 Aegisub "垂直缩放"）
- 自定义 WaveSurfer 插件：网格线（细分线）、小节线、播放头绘制
- 播放头随 `store.currentTime` 同步重绘，auto-center 自动滚动
- 鼠标滚轮语义统一（普通=水平滚动、Ctrl=水平缩放、Shift=切换细分档位）
- TransportBar 吸附按钮右侧两个下拉：细分档位（1x/2x/4x/8x/16x）和节奏模式（Common/Triplets）
- 按住 `Alt` 临时切换至 Triplets（松开恢复，不持久化）
- 全局快捷键：`←/→` 跳分隔线，`Shift+←/Shift+→` 跳小节
- `timing-engine` 新增 `getBeatGridLines` 工具函数
- 项目设置中持久化细分档位（snapDivisor 已有）和节奏模式（新增 rhythmMode）

### 2.2 本次不实现（Out of Scope）

- WordTimelineBar（Phase 4）
- 波形编辑/剪辑
- BPM 自动检测可视化
- 多段 BPM 交叉网格渲染的完整优化（基础可用即可）

## 3. 架构设计

### 3.1 三层职责

```
core/timing/
  timing-engine.ts      ← 新增 getBeatGridLines()：纯函数，不依赖 Vue

platform/waveform/
  wavesurfer-view.ts    ← 封装 WaveSurfer 实例生命周期，与 Vue 无关
  grid-overlay-plugin.ts ← extends BasePlugin，绘制网格/播放头

composables/
  useTimelineView.ts    ← 胶水层：store 状态 → 插件调用；插件事件 → store

components/shell/
  MainView.vue          ← 容器 + 垂直缩放划条（频谱模式）
  TransportBar.vue      ← 新增切换按钮 + 两个下拉
```

### 3.2 关键约束复用

- UI 不直接改数据，所有跳转动作通过 store action（`seekToNextBeat` / `seekToPrevBeat`）。
- `grid-overlay-plugin` 不引入 Vue，只用 `timing-engine` 纯函数。
- 频谱垂直缩放为 UI 层本地状态（不持久化，重新加载重置）。

## 4. 模块详细设计

### 4.1 core/timing/timing-engine.ts — getBeatGridLines

```ts
/** 返回给定时间窗口内的网格线信息 */
export function getBeatGridLines(
  timingPoints: TimingPoint[],
  divisor: number, // 1 = 1拍，2 = 每拍2格，4 = 每拍4格...
  triplets: boolean, // true = 三连音：除以3*2
  startSec: number,
  endSec: number,
): GridLine[]

export interface GridLine {
  time: number // 秒
  type: 'bar' | 'beat' | 'subdivision'
}
```

- 每拍细分数 = triplets ? `divisor * 3 / 2` : `divisor`（Triplets 等效细分规则）。
- 跨越多段 Timing Point 时，对每段分别计算。
- 返回数组按 time 升序；不含 startSec 之前的线。

### 4.2 platform/waveform/grid-overlay-plugin.ts

继承 `BasePlugin`，在 `onInit()` 中：

- 向 `wavesurfer` 注册 `redraw` / `scroll` / `zoom` 事件，触发重绘。
- 在 WaveSurfer 的 wrapper 上叠加一个 `<canvas>`（`position: absolute; inset: 0; pointer-events: none`）。
- 提供公开方法 `update(params: GridOverlayParams)` 供 composable 调用：

```ts
interface GridOverlayParams {
  timingPoints: TimingPoint[]
  currentTime: number
  divisor: number
  triplets: boolean
}
```

- 绘制逻辑：
  1. 根据 pxPerSec 和可见时间范围调用 `getBeatGridLines` 获取线列表。
  2. 按 `type` 分三档颜色/宽度绘制竖线。
  3. 绘制播放头（当前时间对应像素 x，全高竖线）。

### 4.3 platform/waveform/wavesurfer-view.ts

```ts
interface WaveSurferViewOptions {
  container: HTMLElement
  mode: 'waveform' | 'spectrogram'
  autoCenter: boolean
  pxPerSec: number // 初始缩放
  media: HTMLAudioElement // 共享 AudioTransport 的 Audio 元素
}

interface WaveSurferView {
  setMode(mode: 'waveform' | 'spectrogram'): void
  setZoom(pxPerSec: number): void
  setVerticalZoom(scale: number): void // 频谱模式
  getScrollPosition(): number // 当前滚动位置（秒）
  getPlugin<T extends BasePlugin>(cls: new (...args) => T): T | null
  registerPlugin<T extends BasePlugin>(plugin: T): T
  destroy(): void
}
```

- 波形 / 频谱切换：销毁旧 WaveSurfer 实例，在同一容器重建；保持滚动位置。
- 复用 `store` 中已加载的 `HTMLAudioElement`（通过 `media` 选项传入，避免重新解码）。

### 4.4 composables/useTimelineView.ts

```ts
interface TimelineViewState {
  viewMode: Ref<'waveform' | 'spectrogram'>
  pxPerSec: Ref<number>
  verticalZoom: Ref<number>
  divisor: Ref<number> // 细分档位 1|2|4|8|16
  rhythmMode: Ref<'common' | 'triplets'>
  altTripletActive: Ref<boolean>
}
```

职责：

- 创建 `WaveSurferView`，注册 `GridOverlayPlugin`。
- `watch` store.currentTime → 调用 `plugin.update(...)` 重绘。
- 处理滚轮事件路由（通过 `MainView` 向上 emit 后在 composable 内消费）。
- `altTripletActive` 跟踪 `keydown/keyup Alt`；计算 `effectiveTriplets = rhythmMode.value === 'triplets' || altTripletActive.value`。
- 初始化时把 `project.settings.snapDivisor` 同步到 `divisor`；`rhythmMode` 读写 `project.settings.rhythmMode`（通过 command）。

### 4.5 components/shell/MainView.vue 改造

- 新增 `div.waveform-container`（`position: relative; overflow: hidden`）作为 WaveSurfer 挂载根节点。
- 保留拖拽 resize handle。
- **频谱垂直缩放划条**：
  - 仅在 `viewMode === 'spectrogram'` 时渲染。
  - 样式：右侧 `absolute` 定位固定宽度（≈ 24px），内含垂直 `<input type="range">` 旋转 -90°（同音量滑条方案）。
  - 标签文字"垂直缩放"，悬浮或始终可见（始终可见，不弹出）。
  - 滚轮在该划条上触发纵向缩放；其他区域滚轮按统一语义处理。
- 发出 `wheel` 事件（带 modifiers）给 `useTimelineView` 处理，不在组件内直接改 zoom。

### 4.6 components/shell/TransportBar.vue 修改

新增控件（左→右顺序变化）：

> **[波形/频谱切换]** · 节拍器 · 吸附 · **[细分下拉]** · **[节奏下拉]** | 快退 · 播放/暂停 · 快进 | 时间/进度条 | 音量×2

完整顺序说明（从左到右）：波形/频谱切换 → 节拍器开关 → 吸附开关 → 细分档位下拉 → 节奏模式下拉 → 分隔线 → 快退 → 播放/暂停 → 快进 → 时间显示 → 进度条 → 音乐音量 → 音效音量

- **波形/频谱切换按钮**：图标区分两态（如 `material-symbols:waveform` vs `material-symbols:graphic-eq`），`title` 提示当前模式。
- **细分下拉**：`<select>` 或 DaisyUI dropdown，选项 `1x/2x/4x/8x/16x`，对应 divisor `1/2/4/8/16`。
- **节奏下拉**：选项 `Common / Triplets`；按住 `Alt` 时下拉视觉上显示"Triplets (Alt)"但不写值。

### 4.7 快捷键补充

在 `useEditorShortcuts.ts` 注册，`registry.ts` 补类型：

| 快捷键             | Action               | 说明             |
| ------------------ | -------------------- | ---------------- |
| `ArrowLeft`        | `transport.prevBeat` | 跳到上一个细分格 |
| `ArrowRight`       | `transport.nextBeat` | 跳到下一个细分格 |
| `Shift+ArrowLeft`  | `transport.prevBar`  | 跳到上一个小节线 |
| `Shift+ArrowRight` | `transport.nextBar`  | 跳到下一个小节线 |

`seekToNextBeat` / `seekToPrevBeat` 在 `editor-store` 中新增，接受当前 `divisor` 和 `effectiveTriplets`。

> 注：`Alt` 键的 keydown/keyup 监听在 `useTimelineView` 内部处理，不走 shortcut registry（避免与跨平台 Alt 组合键冲突）。

## 5. 数据模型变更

### 5.1 ProjectSettings 扩展

```ts
export interface ProjectSettings {
  locale: LocaleCode
  snapDivisor: 4 | 8 | 16 // 现有，与 divisor 1x/2x/... 共存
  rhythmMode: 'common' | 'triplets' // 新增，默认 'common'
}
```

`createEmptyProject` 中 `rhythmMode` 默认 `'common'`。

### 5.2 store 新增 actions

```ts
seekToNextBeat(divisor: number, triplets: boolean): void
seekToPrevBeat(divisor: number, triplets: boolean): void
setRhythmMode(mode: 'common' | 'triplets'): void
```

## 6. 错误处理

- WaveSurfer 加载失败（不支持格式 / AudioContext 被阻断）→ 显示明确文案，使用 `store.lastError`。
- `getBeatGridLines` 收到空 `timingPoints` → 返回 `[]`，插件不绘制任何线，不 throw。
- `grid-overlay-plugin` 的 canvas 操作在 `wavesurfer` 未初始化时提前 return，不 throw。
- 频谱 Spectrogram 插件加载中（web worker 解码）→ 显示 loading 状态覆盖层。

## 7. 测试策略

### 7.1 单元测试（`core/timing/`）

- `getBeatGridLines`：
  - 基础情况：单段 120BPM 4/4，divisor=4，Common，给定时间窗口 → 预期线数量和类型。
  - Triplets 模式下细分数正确。
  - 空 timingPoints → 返回 `[]`。
  - 跨两段 BPM 变更的时间窗口 → 线密度分段正确。

### 7.2 Composable 测试（`useTimelineView`）

- mock WaveSurfer + mock plugin，验证：
  - 视图模式切换触发 `setMode` 调用。
  - `currentTime` 变化触发 `plugin.update`。
  - `altTripletActive` 在 keydown/keyup 事件后正确翻转。

### 7.3 组件测试

- `TransportBar`：新增按钮/下拉存在性；切换按钮点击触发 `viewMode` 变更事件。
- `MainView`：
  - 垂直缩放划条在频谱模式下渲染、波形模式下不渲染。
  - 已有拖拽 resize 测试保持绿色。

### 7.4 快捷键测试

- `←/→` 触发 `transport.prevBeat` / `transport.nextBeat` action。
- `Shift+←/Shift+→` 触发 `transport.prevBar` / `transport.nextBar`。

## 8. 与 Phase 4 的衔接

- `MainView` 中的 WaveSurfer wrapper 下方将是 `WordTimelineBar` 的挂载区域；Phase 3 预留 `data-testid="word-timeline-bar-slot"` 占位 div。
- `getBeatGridLines` 结果可直接供 Phase 4 的词块吸附逻辑复用。
- `useTimelineView` 的 `viewMode` / `pxPerSec` 将共享给 `WordTimelineBar` 以保持水平滚动同步。

## 9. 实现记录

- 2026-05-18: Phase 3 设计文档创建。
