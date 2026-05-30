# Phase 5 Plus Part 11：Overlay 拖拽编辑设计

## 背景

`LineOverlay` 目前已经把每行歌词的起止时间与每个词的边界可视化在波形/频谱时间线上，但只允许通过键盘（D / Enter / Shift+D 等）打轴。Part 11 引入鼠标拖拽编辑：用户可以直接拖动每个时间边界来调整歌词 timing。

本 Part 的核心耦合点是 `platform/waveform/line-overlay-plugin.ts`（Vue-free）与 Vue/store 层之间的接口。设计必须满足：

- platform overlay 代码不能直接修改项目数据；
- platform overlay 只发出意图数据，由 Vue/store 层应用 command；
- 现有键盘打轴流程必须继续可用。

## 已确定的核心决策

1. **拖拽作用域**：所有可见行的边界都允许拖动；`pointerdown` 自动把对应行切换为激活行（轻量切换，不触发 seek）。
2. **拖拽过程视觉**：边界**实时 snap 跳动**到最近 snap 候选位置；拖拽期间不显示独立的 ghost 预览线。
3. **越界处理**：clamp 到相邻边界之间（带 EPSILON）。
4. **辅助键**：不引入临时 timing 修饰键（Shift / Alt 等均不改变 snap 或 clamp 行为）；Esc 仅作为拖拽取消键。要禁 snap 请去 TransportBar 关磁铁开关。
5. **架构**：`LineOverlayPlugin` 发自定义事件 → `useTimelineView` 做胶水 → `useEditorStore` 走现有 command。
6. **snap 计算归属**：在 composable 内调 `core/lyrics/snap-time.computeSnappedTime`，结果通过 `plugin.update({ dragPreview })` 回传给插件用来重画。
7. **不引入新 command**：复用 `createSetLineStartTimeCommand` 和 `createSetWordEndTimeCommand`；单次拖拽 = 单条 undo entry。

## §1 组件架构与数据流

```
┌──────────────────────────────────────────────────────────────┐
│ LineOverlayPlugin (platform, Vue-free)                       │
│ - 维护 hit area (透明 div, pointerEvents: 'auto')             │
│ - 监听 pointerdown / move / up / Escape keydown               │
│ - 发自定义事件:                                                │
│     'boundaryDragStart'  { intent }                          │
│     'boundaryDragMove'   { intent, rawTime }                 │
│     'boundaryDragEnd'    { intent, rawTime }                 │
│     'boundaryDragCancel' { intent }                          │
│ - 接收 update({ dragPreview })  →  在拖拽中渲染 snap 高亮线   │
└─────────────┬─────────────────────────────────────▲──────────┘
              │ events                  update({…})  │
              ▼                                       │
┌──────────────────────────────────────────────────────────────┐
│ useTimelineView (Vue composable)                             │
│ - 订阅插件拖拽事件                                              │
│ - on dragStart: 暂存 originalTime；切换 activeLine             │
│ - on dragMove:                                                │
│     1. computeSnappedTime(rawTime, intent context)            │
│     2. clamp(snapped, neighbors)                              │
│     3. plugin.update({ dragPreview: {intent, time: clamped} })│
│ - on dragEnd: 调用 store 对应 setLineStartTime/setWordEndTime  │
│ - on dragCancel: plugin.update({ dragPreview: undefined })    │
└─────────────┬────────────────────────────────────────────────┘
              │ store.setLineStartTime / setWordEndTime
              ▼
┌──────────────────────────────────────────────────────────────┐
│ editor-store (Pinia)                                         │
│ - 复用已有 setLineStartTime / setWordEndTime                   │
│ - 走 createSetLineStartTimeCommand / createSetWordEndTimeCmd │
│ - 单次 dragEnd = 单条 command = 单步 undo                     │
│ - 完成时 showStatus('status.lyrics.drag*', ...)                │
└──────────────────────────────────────────────────────────────┘
```

关键不变量：

- `LineOverlayPlugin` 完全 Vue / store-free，只发事件 + 接收 props。
- 拖拽不引入新 command 类型。
- 单次拖拽 = 单条 undo entry，因为只在 `dragEnd` 提交一次。
- 现有键盘打轴流程零改动（`useLyricsEditor` 仅追加一个 `selectLine`）。

## §2 `LineOverlayPlugin` 改动

### 新增 props

```ts
interface DragPreview {
  intent: BoundaryDragIntent
  time: number // composable 算好的 clamped + snapped 时间
}

interface LineOverlayParams {
  // 既有字段保留
  lyrics: LyricLine[]
  activeLineId: string | null
  activeWordIndex?: number
  theme: OverlayStyleContext['theme']
  viewMode: OverlayStyleContext['viewMode']
  // 新增
  dragPreview?: DragPreview
  duration: number // 用于 px ↔ time 计算和边界裁剪
}
```

### `BoundaryDragIntent` 类型

```ts
type BoundaryDragIntent =
  | { kind: 'line-start'; lineId: string }
  | { kind: 'line-end'; lineId: string; wordId: string }
  | { kind: 'word-separator'; lineId: string; wordId: string }
```

数据模型里 `word_i.start === word_{i-1}.end`，因此每个分词边界只对应一个数据值，永远以"左侧词的 endTime"为载体。`line-end`（实线，最后一个词已 timed）映射到最后一个词的 `endTime`。`partial-line-end`（虚线，当前行最后一个 timed word 的最大 endTime）映射到这个最后 timed word 的 `endTime`，不是映射到行本身，也不是映射到未 timed 的最后一个词；二者都可拖，提交时都走 `setWordEndTime`。

### 事件（继承 `BasePluginEvents`）

```ts
interface LineOverlayEvents extends BasePluginEvents {
  boundaryDragStart: [{ intent: BoundaryDragIntent }]
  boundaryDragMove: [{ intent: BoundaryDragIntent; rawTime: number }]
  boundaryDragEnd: [{ intent: BoundaryDragIntent; rawTime: number }]
  boundaryDragCancel: [{ intent: BoundaryDragIntent }]
}
```

### Hit area

- 在每个 boundary 元素同级位置叠透明 hit area：宽约 `10px`，`pointerEvents: 'auto'`，`cursor: 'ew-resize'`，`zIndex` 略高于内容。
- `dataset.testid`：
  - `line-start` → `boundary-handle-line-start-${lineId}`
  - `line-end` → `boundary-handle-line-end-${lineId}`（载体仍是 `wordId`，但 testid 用 lineId 便于定位）
  - `word-separator` → `boundary-handle-word-separator-${wordId}`
- hover 时 boundary 主题色微亮，作为可拖感知反馈。
- `partial-line-end`（虚线）的 hit area 行为与 `word-separator` 相同（都是某词的 endTime），其 intent 使用当前最后一个 timed word 的 `wordId`。
- **不渲染 hit area 的情况**：当 `words[i-1].endTime === undefined`（即"前一个词未 timed，但当前词已 timed"的导入态）时，word-separator 在视觉上仍按现有逻辑落在 `line.startTime` 位置，本设计**不**给它附 hit area，避免与 `line-start` 的 hit area 重叠并产生歧义。被排除的中间无意义边界不可拖；用户需先在 LyricsLineList 里把前一个词补齐 timing。

### Pointer 状态机

1. `pointerdown` on hit area：`setPointerCapture` → 解出 intent → emit `boundaryDragStart` → 记录 `dragIntent`、`lastClientX`。
2. `pointermove`（capture 时）：更新 `lastClientX`，计算 rawTime 后 emit `boundaryDragMove`。预览渲染等 composable 通过 `update({ dragPreview })` 触发。
3. `pointerup`：emit `boundaryDragEnd` → `releasePointerCapture` → 状态机重置。
4. `keydown Escape`（拖拽中）：emit `boundaryDragCancel` → `releasePointerCapture`（若仍持有）→ 状态机重置；取消不写 command、不显示 status。

### 坐标换算

使用一个内部 helper 统一从指针位置得到时间，避免横向滚动被重复计入：

```ts
function _clientXToRawTime(clientX: number): number {
  const wrapper = this.wavesurfer!.getWrapper()
  const duration = this.params.duration || this.wavesurfer!.getDuration()
  const pxPerSec = duration > 0 ? wrapper.scrollWidth / duration : 0
  if (pxPerSec <= 0) return 0

  // wrapper 本身处在可滚动内容坐标系里；getBoundingClientRect().left
  // 已随 scrollLeft 变成负值，因此这里不能再额外加 scrollLeft。
  const contentX = clientX - wrapper.getBoundingClientRect().left
  return Math.max(0, Math.min(duration, contentX / pxPerSec))
}
```

自动滚动 RAF tick 复用 `lastClientX` 调 `_clientXToRawTime(lastClientX)`，这样即使鼠标不动、`scrollLeft` 改变，`wrapperRect.left` 也会变化，rawTime 会自然推进。

### `_draw()` 改动

- 为每条 boundary 增加对应 hit-area DOM。
- 当 `params.dragPreview` 存在且匹配某条 boundary：
  - 该 boundary 的 `left` 改用 `dragPreview.time * pxPerSec` 对应的相对位置，盖住数据中的原值；
  - 如果拖的是 `line-start`，对应 `lyric-range-${line.id}` 的 `left` 和 `width` 也用 preview start 与当前 line end 重新计算；
  - 如果拖的是 `line-end` 或 `partial-line-end` 的载体词，range 的 `width` 也用当前 line start 与 preview end 重新计算；
  - 如果拖的是中间 `word-separator`，只移动该 separator 与相邻 word label / selected range 的分段宽度；行整体 range 起止不变；
  - 叠一条 dragPreview 高亮线（亮色 + 半透明 glow）。
- `dragPreview === undefined` 时一切回到数据驱动渲染。

### 拖到边缘自动滚动

- 在 `pointermove` 中检测 cursor 距 wrapper 左/右边缘是否 < `EDGE_SCROLL_ZONE_PX`（建议 `40px`）。
- 进入 zone 启动 `requestAnimationFrame` 循环；离开 zone 停掉循环。
- 单帧位移 `delta = MAX_SCROLL_SPEED_PX_PER_FRAME * (1 - distanceFromEdge / EDGE_SCROLL_ZONE_PX)`，建议 `MAX_SCROLL_SPEED_PX_PER_FRAME = 12`。
- RAF tick：写 `scrollContainer.scrollLeft`（自动 clamp 到 `[0, scrollWidth - clientWidth]`），重新计算 `rawTime` 并 emit `boundaryDragMove`，即使鼠标未动也能继续更新。
- 写 `scrollContainer.scrollLeft` 会触发 WaveSurfer `scroll` 事件，自然走原 overlay 重绘路径。`useTimelineView` 在 `boundaryDragStart` 时同步设置 `suppressAutoFollow = true`，避免 playback auto-follow 把视口拽回去。
- `pointerup` / cancel / destroy 时 `cancelAnimationFrame(rafId)` 并清空 `rafId = null`。
- 自动滚动到 `scrollLeft` 边界时停止位移，但 RAF 循环仍可继续 emit move；clamp 后边界保持在 0 或 duration。
- 第一版采用线性加速曲线即可。

## §3 `useTimelineView` composable 改动

### 内部状态

```ts
let dragSession: {
  intent: BoundaryDragIntent
  originalTime: number // 拖前的原始值，用于 cancel / no-op
  lastSnappedTime: number // 用于去重：与上次相同不必 emit update
} | null = null
let suppressAutoFollow = false
let lineOverlayDragUnsubscribers: Array<() => void> = []
```

### Helper：从 intent 读出原始时间

```ts
function _readTimeForIntent(intent: BoundaryDragIntent): number | undefined {
  const line = store.project.lyrics.find((l) => l.id === intent.lineId)
  if (!line) return undefined
  if (intent.kind === 'line-start') return line.startTime
  const word = line.words.find((w) => w.id === intent.wordId)
  return word?.endTime
}
```

如果 `_readTimeForIntent` 返回 `undefined`（理论上插件只在数据存在时发起拖拽，但若 pointerdown 与 dragStart 之间存在罕见 race），`useTimelineView` 直接忽略本次 `boundaryDragStart`，不建立 `dragSession`，后续 move/end 也都因 `dragSession === null` 而被跳过。

提交前也再次调用 `_readTimeForIntent(intent)` 检查目标仍存在。若拖拽过程中用户 undo / 导入 / 删除歌词导致目标 line 或 word 不存在，则本次 dragEnd 当作 cancel：清掉 preview、解除 `suppressAutoFollow`，不写 command。若目标仍存在但时间已被外部改动，拖拽的最终值按“最后用户拖拽胜出”提交为新 command。

### Helper：selectLine 语义

新增 `useLyricsEditor.selectLine(lineId)`：

```ts
function selectLine(lineId: string): void {
  if (activeLineId.value === lineId) return // no-op：保持 activeWordIndex 稳定
  const line = store.project.lyrics.find((l) => l.id === lineId)
  if (!line) return
  _suppressWatchSync = true // 抑制一次 watch，避免立即被派生覆盖
  activeLineId.value = lineId
  activeWordIndex.value = 0
}
```

与 `activateLine` 的区别：

- **不**调 `store.seekPlayback`。
- **不**走 seek priority degradation。
- 同行重复 `selectLine` 时是 no-op，避免把 `activeWordIndex` 重置为 0 打断用户上下文。

### Clamp helper（放到 core）

新增纯函数 `core/lyrics/boundary-bounds.ts`：

```ts
function getDragClampBounds(
  intent: BoundaryDragIntent,
  lyrics: readonly LyricLine[],
  duration: number,
): { min: number; max: number }
```

规则：

- `kind === 'line-start'`：
  - `min = 上一行最后一个 timed word 的 endTime`（若存在），否则 `0`
  - `max = 本行第一个 timed word 的 endTime`（若存在），否则下一行 `startTime`（若存在），否则 `duration`
- `kind === 'line-end'`：
  - `min = wordId 前一个词的 endTime`（若存在），否则本行 `startTime`
  - `max = 下一行 startTime`（若存在），否则 `duration`
- `kind === 'word-separator'`：
  - `min = wordId 前一个词的 endTime`（若存在），否则本行 `startTime`
  - `max = wordId 后一个词的 endTime`（若 timed），否则下一行 `startTime`（若存在），否则 `duration`
- 所有边界加 `EPSILON = 0.001` 收缩，避免完全相等。
- `duration <= 0` 时返回 `{ min: 0, max: 0 }`，composable 不建立可提交拖拽。
- 收缩后的区间若出现 `max < min`（例如相邻边界距离小于 `2 * EPSILON`），返回一个归一化的零宽区间 `{ min: midpoint, max: midpoint }`。这类拖拽只能预览到中点；dragEnd 通常因 `< EPSILON` 判定为 no-op，避免制造非法顺序。

### Snap 占位集合

复用 `useLyricsEditor._getSnappedTime` 思路，剔除"被拖的那个 endTime"：

- `word-separator` / `line-end`：从本行 endTimes 里剔除 `intent.wordId`。
- `line-start`：本行全部 endTimes 参与（`line.startTime` 自身不在 endTimes 集合里）。

### 事件订阅

```ts
function _teardownLineOverlayDragSubscriptions(): void {
  for (const off of lineOverlayDragUnsubscribers) off()
  lineOverlayDragUnsubscribers = []
}

function _subscribeLineOverlayDragEvents(plugin: LineOverlayPlugin): void {
  _teardownLineOverlayDragSubscriptions()
  lineOverlayDragUnsubscribers = [
    plugin.on('boundaryDragStart', _handleBoundaryDragStart),
    plugin.on('boundaryDragMove', _handleBoundaryDragMove),
    plugin.on('boundaryDragEnd', _handleBoundaryDragEnd),
    plugin.on('boundaryDragCancel', _handleBoundaryDragCancel),
  ]
}

lineOverlayPlugin.on('boundaryDragStart', ({ intent }) => {
  const originalTime = _readTimeForIntent(intent)
  if (originalTime === undefined || store.duration <= 0) return
  dragSession = {
    intent,
    originalTime,
    lastSnappedTime: NaN,
  }
  suppressAutoFollow = true
  options.onBoundaryDragStart?.(intent)
})

lineOverlayPlugin.on('boundaryDragMove', ({ intent, rawTime }) => {
  if (!dragSession) return
  const existing = _collectExistingEndTimes(intent)
  const snapped = computeSnappedTime({
    rawTime,
    snapEnabled: store.snapEnabled,
    timingPoints: store.project.timingPoints,
    divisor: divisor.value,
    triplets: effectiveTriplets.value,
    existingEndTimes: existing,
  })
  const { min, max } = getDragClampBounds(intent, store.project.lyrics, store.duration)
  const clamped = Math.max(min, Math.min(max, snapped))
  if (clamped === dragSession.lastSnappedTime) return
  dragSession.lastSnappedTime = clamped
  lineOverlayPlugin?.update({
    ..._buildLineOverlayParams(),
    dragPreview: { intent, time: clamped },
  })
})

lineOverlayPlugin.on('boundaryDragEnd', ({ intent, rawTime }) => {
  if (!dragSession) return
  const session = dragSession
  dragSession = null
  suppressAutoFollow = false
  if (_readTimeForIntent(session.intent) === undefined) {
    lineOverlayPlugin?.update(_buildLineOverlayParams())
    return
  }
  const finalTime = Number.isNaN(session.lastSnappedTime)
    ? session.originalTime
    : session.lastSnappedTime
  if (Math.abs(finalTime - session.originalTime) < EPSILON) {
    lineOverlayPlugin?.update(_buildLineOverlayParams())
    return
  }
  _commitBoundary(intent, finalTime)
})

lineOverlayPlugin.on('boundaryDragCancel', ({ intent }) => {
  dragSession = null
  suppressAutoFollow = false
  lineOverlayPlugin?.update(_buildLineOverlayParams())
})
```

上面的 inline 代码表达目标结构；实际实现可拆成命名 handler，重点是 `_initWaveSurfer()` 每次创建新 plugin 后调用 `_subscribeLineOverlayDragEvents(lineOverlayPlugin)`，`setViewMode()` destroy/recreate 前与 `onUnmounted()` 都调用 `_teardownLineOverlayDragSubscriptions()`。这样旧 plugin 的事件闭包不会在 view mode 切换后残留。

### Commit

```ts
function _commitBoundary(intent: BoundaryDragIntent, time: number): void {
  switch (intent.kind) {
    case 'line-start':
      store.setLineStartTime(intent.lineId, time)
      store.showStatus('status.lyrics.dragLineStart', { time: formatTimestamp(time) })
      break
    case 'line-end':
      store.setWordEndTime(intent.lineId, intent.wordId, time)
      store.showStatus('status.lyrics.dragLineEnd', { time: formatTimestamp(time) })
      break
    case 'word-separator':
      store.setWordEndTime(intent.lineId, intent.wordId, time)
      store.showStatus('status.lyrics.dragWordEnd', { time: formatTimestamp(time) })
      break
  }
}
```

`store.setLineStartTime` / `store.setWordEndTime` 会先显示既有 command status；拖拽 commit 随后用 `status.lyrics.drag*` 覆盖它。最终用户只看到拖拽语义的成功提示。

### 与 auto-follow 的协调

- 在已有 `watch(() => store.currentTime, ...)` 的 auto-follow 条件里加 `&& !suppressAutoFollow`。
- `boundaryDragStart` 置 `true`，`boundaryDragEnd` / `boundaryDragCancel` 解除；`onUnmounted` 兜底清空。
- `setViewMode()` destroy/recreate 前也必须把 `dragSession = null`、`suppressAutoFollow = false`，并清掉 overlay preview。

### 自动激活行的接入点

- `useTimelineView` 通过新 option `options.onBoundaryDragStart?: (intent) => void` 暴露给 `AppShell`。
- `AppShell.vue` 把它接到上面定义的 `useLyricsEditor.selectLine(intent.lineId)`，仅切换 `activeLineId.value`，不 seek。
- 原 `activateLine` 保留键盘语义（含 seek）。
- `selectLine` 只做行级轻量激活：同行 no-op；跨行时 `activeWordIndex` 置 0。拖拽 word boundary 不主动把 active word 切到对应词，避免拖动边界时改变用户原先的词级上下文。

## §4 i18n / StatusBar 与边界情况清单

### 新增 i18n keys

```jsonc
{
  "status": {
    "lyrics": {
      "dragLineStart": "已通过拖拽调整该行开始时间至 {time}",
      "dragLineEnd": "已通过拖拽调整该行结束时间至 {time}",
      "dragWordEnd": "已通过拖拽调整词边界至 {time}",
    },
  },
}
```

- 三个 success key 按 intent 分发：`line-start` → `dragLineStart`；`line-end` → `dragLineEnd`；`word-separator` → `dragWordEnd`。
- 取消 / 微小拖动 / clamp 命中不显式提示。
- `formatTimestamp` 复用 `src/core/utils/format-timestamp.ts` 输出 `MM:SS.mmm`。
- `i18n/status-label-maps.ts` 无需扩展（这几个 key 不走 commandLabel 映射）。

### 边界情况完整清单

| 情况                                                                 | 设计行为                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| mousedown 后立刻 mouseup，未移动                                     | `lastSnappedTime === NaN` → 按 `originalTime` 落地，`Math.abs(diff) < EPSILON` → 不写 command |
| 拖动距离 < EPSILON                                                   | 同上，不写 command（避免 undo 栈污染）                                                        |
| 拖到相邻边界 + EPSILON 之外                                          | clamp 到 `[min + EPSILON, max - EPSILON]`                                                     |
| 相邻边界间距小于 `2 * EPSILON`                                       | clamp helper 归一化到中点；通常 no-op，不产生非法顺序                                         |
| 拖到时间线最左 / 最右                                                | clamp 到 `[0, duration]`（已含在 min/max 计算）                                               |
| 音频未加载或 `duration <= 0`                                         | overlay 理论上不渲染可拖边界；composable 即使收到事件也不建立可提交 dragSession               |
| `snapEnabled === false`                                              | `computeSnappedTime` 返回 `rawTime`，clamp 后照样提交                                         |
| `timingPoints.length === 0`                                          | 同上无 snap，clamp 仍生效                                                                     |
| 拖动 `partial-line-end`（虚线）                                      | 与普通 `word-separator` 同处理                                                                |
| 中间未 timed 但后面词已 timed 的奇异分隔                             | hit area 不渲染，无法拖（详见 §2 Hit area 末段）                                              |
| 拖动行起点跨过上一行最后 timed word                                  | clamp 阻止；不显式提示                                                                        |
| 拖到视口外                                                           | auto-scroll 启动；scrollLeft 到端后 clamp 保持在端点                                          |
| 拖拽中音频继续播放                                                   | 不暂停；`suppressAutoFollow` 屏蔽跟随，pointerup 后恢复                                       |
| 拖拽中按 Ctrl+Z，目标仍存在                                          | 拖拽尚未提交，撤销的是拖拽之前的最近一次 command；mouseup 时以拖拽最终值提交新一步            |
| 拖拽中按 Ctrl+Z / 删除 / 导入导致目标不存在                          | dragEnd 当作 cancel；清 preview，不写 command                                                 |
| 拖拽过程中切换 view mode                                             | destroy/recreate 前清 `dragSession`、`suppressAutoFollow`、事件订阅和 preview                 |
| 拖拽过程中音频文件被替换                                             | 同上，destroy/recreate → cleanup                                                              |
| pointerdown 后数据被外部改动导致 `_readTimeForIntent` 返回 undefined | composable 忽略本次 dragStart，dragSession 不建立，后续事件全部 no-op                         |
| 拖拽中按 Esc                                                         | 发 `boundaryDragCancel`，清 preview，不写 command，不显示 status                              |

### 关键 invariant

- `dragSession === null` ⇔ overlay 不在拖拽模式 ⇔ `dragPreview === undefined`
- `suppressAutoFollow === true` ⇔ `dragSession !== null`

## §5 测试计划

本 Part 必须按 TDD 落地：先写测试，再实现。

### A. `core/lyrics/boundary-bounds.spec.ts`（新文件，纯函数）

| 用例                                                          | 期望                                     |
| ------------------------------------------------------------- | ---------------------------------------- |
| line-start, 首行, 无 timing 数据                              | `{ min: 0, max: duration }`              |
| line-start, 中间行, 上一行末 timed                            | `min = prevLine.lastTimedWord.endTime`   |
| line-start, 中间行, 本行第一个词 timed                        | `max = words[0].endTime`                 |
| line-start, 中间行, 本行尚无 timed word, 但下一行有 startTime | `max = nextLine.startTime`               |
| word-separator, 中间词, 前后词皆 timed                        | `min = prev.endTime, max = next.endTime` |
| word-separator, 中间词, 后面词都未 timed                      | `max = duration` / `nextLine.startTime`  |
| line-end, 末位词 + 下一行有 startTime                         | `max = nextLine.startTime`               |
| line-end, 末位词 + 最后一行                                   | `max = duration`                         |
| 全部返回带 EPSILON 收缩                                       | 用 `expect.closeTo`                      |
| `duration <= 0`                                               | `{ min: 0, max: 0 }`                     |
| 收缩后 `max < min` 的窄区间                                   | 返回中点零宽区间                         |

### B. `platform/waveform/line-overlay-plugin.spec.ts`（扩展既有）

| 用例                                                   | 期望                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| boundary hit area DOM 存在                             | 每种 boundary 渲染对应 `data-testid="boundary-handle-*"`                         |
| hit area `pointerEvents: 'auto'`, cursor `'ew-resize'` | inline style 检查                                                                |
| 中间无 timed 但后面词 timed 的奇异分隔无 hit area      | `data-testid="boundary-handle-word-separator-*"` 不存在                          |
| pointerdown on line-start hit area                     | emit `boundaryDragStart`，`intent.kind === 'line-start'`                         |
| pointerdown on word-separator hit area                 | emit `boundaryDragStart`，`kind === 'word-separator'`，`wordId === word[i-1].id` |
| pointerdown on partial-line-end hit area               | emit `boundaryDragStart`，`kind === 'word-separator'`                            |
| pointermove（无 scroll）                               | emit `boundaryDragMove` with 正确 `rawTime`                                      |
| pointermove（scrollLeft > 0）                          | `rawTime` 不重复叠加 scrollLeft                                                  |
| pointerup                                              | emit `boundaryDragEnd`                                                           |
| `update({ dragPreview })`                              | 被拖 boundary 的 `left` 跳到预览位置                                             |
| `dragPreview` on line-start                            | range `left` 和 `width` 跟随 preview 重算                                        |
| `dragPreview` on line-end / partial-line-end           | range `width` 跟随 preview 重算                                                  |
| `dragPreview` on word-separator                        | 相邻 word label / selected range 跟随 preview 重算，range 外框不变               |
| `dragPreview` 同时出 highlight 元素                    | `data-testid="boundary-handle-drag-preview"` 存在                                |
| `dragPreview === undefined`                            | 无 highlight                                                                     |
| auto-scroll: cursor 进入左/右 zone                     | `scrollContainer.scrollLeft` 在 RAF tick 内改变                                  |
| auto-scroll: 鼠标不动但 scrollLeft 变化                | RAF tick 继续 emit 基于最新 wrapper rect 的 `rawTime`                            |
| auto-scroll: cursor 离开 zone                          | RAF 循环停止                                                                     |
| destroy()                                              | `cancelAnimationFrame` 被调，状态机重置                                          |
| Escape keydown 拖拽中                                  | emit `boundaryDragCancel`                                                        |
| pointerup 后再 Escape                                  | **不**再 emit cancel                                                             |

happy-dom 注意：`setPointerCapture` / `releasePointerCapture` 可能缺失，在 spec 内 mock。

### C. `composables/useTimelineView.spec.ts`（新文件）

挂载最小宿主组件 + `setActivePinia(createPinia())` + 替身 plugin（暴露 emit）。

| 用例                                                              | 期望                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| dragStart 触发 `onBoundaryDragStart`                              | 回调收到 intent                                                             |
| dragStart 时数据缺失（`_readTimeForIntent` 返回 undefined）       | `dragSession` 不建立，后续 move/end 不 emit update / 不调 store.set\*       |
| dragStart 时 `store.duration <= 0`                                | `dragSession` 不建立                                                        |
| dragStart 期间 `currentTime` 变化                                 | `scrollPlaybackTo` 未被调（auto-follow 屏蔽）                               |
| dragMove → `plugin.update({ dragPreview })`，time 已 clamp + snap | spy；timingPoints/divisor 触发 snap 到已知格点                              |
| dragMove 越过 max                                                 | `time === max - EPSILON`                                                    |
| dragMove 越过 min                                                 | `time === min + EPSILON`                                                    |
| dragEnd                                                           | 调 `store.setWordEndTime` 一次；command 数量 +1                             |
| dragEnd 前目标 word/line 消失                                     | 清 preview；不调 store.set\*；command 数量不变                              |
| dragEnd 前目标仍存在但原时间被外部改动                            | 最终拖拽时间作为新 command 提交                                             |
| dragEnd 后 `dragPreview` 被清掉                                   | 后续 `update()` 不再带 dragPreview                                          |
| dragEnd 微小移动 (< EPSILON)                                      | 不调 store.set\*；command 数量不变                                          |
| dragEnd line-start intent                                         | 调 `setLineStartTime`，不是 `setWordEndTime`                                |
| dragCancel                                                        | 不调 store.set\*；dragPreview 清；`suppressAutoFollow` 解除                 |
| `snapEnabled === false`                                           | dragMove.time === clamp(rawTime)（无 snap）                                 |
| `timingPoints === []`                                             | 同上                                                                        |
| status 提示 key                                                   | spy `store.showStatus` 调用 `dragLineStart` / `dragLineEnd` / `dragWordEnd` |
| status 覆盖                                                       | commit 后最终 status 是 `status.lyrics.drag*`                               |
| setViewMode destroy/recreate                                      | 旧 plugin 事件订阅被 teardown，dragSession / suppressAutoFollow 清空        |
| `onUnmounted` 清掉 dragSession + suppressAutoFollow               | wrap unmount 后 spy 检查                                                    |

### D. `composables/useLyricsEditor.spec.ts`（扩展）

| 用例                                           | 期望                        |
| ---------------------------------------------- | --------------------------- |
| `selectLine(lineId)` 仅改 `activeLineId.value` | 不调 `store.seekPlayback`   |
| `selectLine` 同行 no-op                        | 保持 `activeWordIndex` 不变 |
| `selectLine` 跨行                              | `activeWordIndex` 置 0      |
| `activateLine(lineId)` 保留原行为              | 仍调 seek（既有测试不动）   |

### E. `components/shell/AppShell.spec.ts`（扩展）

| 用例                          | 期望                                          |
| ----------------------------- | --------------------------------------------- |
| 插件 emit `boundaryDragStart` | `lyricsEditor.activeLineId === intent.lineId` |
| 自动激活时不触发 seek         | `store.seekPlayback` spy 未被调               |
| 拖拽 word boundary 时         | 只激活行，不主动选择对应词                    |

### F. 现有键盘流程零回归

- 既有 `useLyricsEditor.spec.ts` 全部通过。
- 拖拽未发生时，overlay 行为与改造前一致。

### G. Manual smoke（非自动化）

1. `pnpm dev` → 打开含多行歌词、部分 timed 的工程。
2. 拖动 line-start：边界跳格，松手落格，undo 可撤回。
3. 拖动末位词 endTime 越过下一行 startTime：被 clamp。
4. 拖到视口边缘：自动滚动。
5. 拖拽中按 Ctrl+Z：commit 后再撤销，仍回到上一步。
6. 拖拽中音频继续播放：playhead 不被拖动影响。

## §6 文件改动总览

### 新增文件

| 文件                                                                            | 内容                                                            |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/core/lyrics/boundary-bounds.ts`                                            | 纯函数 `getDragClampBounds(intent, lyrics, duration)` + EPSILON |
| `src/core/lyrics/boundary-bounds.spec.ts`                                       | 上述纯函数测试                                                  |
| `src/composables/useTimelineView.spec.ts`                                       | composable 拖拽编排测试                                         |
| `docs/superpowers/specs/2026-05-30-phase-5-plus-part-11-overlay-drag-design.md` | 本设计文档                                                      |

### 修改文件

| 文件                                                | 内容                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/platform/waveform/line-overlay-plugin.ts`      | 加 `BoundaryDragIntent` 类型 + 事件 + hit area + pointer 状态机 + dragPreview 渲染 + auto-scroll RAF   |
| `src/platform/waveform/line-overlay-plugin.spec.ts` | 对应扩展                                                                                               |
| `src/composables/useTimelineView.ts`                | 订阅插件事件、调 snap/clamp、emit 给 plugin、commit 走 store；新增 `options.onBoundaryDragStart`       |
| `src/composables/useLyricsEditor.ts`                | 新增 `selectLine(lineId)`（不 seek）                                                                   |
| `src/composables/useLyricsEditor.spec.ts`           | 加 `selectLine` 测试                                                                                   |
| `src/components/shell/AppShell.vue`                 | 把 `useTimelineView({ onBoundaryDragStart: (intent) => lyricsEditor.selectLine(intent.lineId) })` 接起 |
| `src/components/shell/AppShell.spec.ts`             | 集成测试扩展                                                                                           |
| `src/i18n/locales/*.json`                           | 加 `status.lyrics.dragLineStart` / `dragLineEnd` / `dragWordEnd`                                       |
| `docs/phase-5-plus-stepped-spec.md`                 | 实施时把 Part 11 标记完成                                                                              |
| `docs/patterns/timeline-audio-lyrics.md`            | 补两条 pattern：`LineOverlayPlugin` 拖拽事件契约；composable 计算 snap 后回传 plugin 画                |

### 不动的文件

- `src/core/commands/lyrics-commands.ts`：复用 `createSetLineStartTimeCommand` / `createSetWordEndTimeCommand`。
- `src/stores/editor-store.ts`：复用 `setLineStartTime` / `setWordEndTime`。
- `src/components/shell/StatusBar.vue`：i18n 自动 fallback。
- `src/components/shell/MainView.vue`：本设计判定不需要动（spec 列了它但拖拽全部在 plugin / composable）。
- `src/core/commands/`、`src/core/timing/`、`src/core/domain/`：完全不动。
- `src/i18n/status-label-maps.ts`：新 key 不走 commandLabel 映射，无需扩展。

### 验收要点回顾

| 要点                                            | 本设计是否满足                                     |
| ----------------------------------------------- | -------------------------------------------------- |
| platform overlay 代码不能直接修改项目数据       | ✓ plugin 只发事件 + 接 props，从不访问 store       |
| platform overlay 只发出意图数据                 | ✓ `BoundaryDragIntent` + 四个 event                |
| 现有键盘打轴流程必须继续可用                    | ✓ `useLyricsEditor` 仅增 `selectLine`，原 API 不动 |
| 拖拽结果转换为现有 command                      | ✓ 复用 `setLineStartTime` / `setWordEndTime`       |
| 拖拽目标按项目吸附设置进行 snap                 | ✓ composable 调 `computeSnappedTime`               |
| 无效拖拽和成功 timing 更新通过 `StatusBar` 提示 | ✓ commit 时 `showStatus`                           |

## §7 本 Part 不做（防 scope creep）

- 拖拽到非时间线 boundary（如调换词顺序、行重排）。
- 多边界同时选中 + 整段平移。
- 拖拽 `partial-line-end` 时主动补齐未 timed 的尾部词。
- 拖拽 + 临时辅助键（Shift skip-snap 等）。
- 自动滚动非线性加速曲线（线性即可）。
- 触控 / 笔事件特殊适配（用 PointerEvent 通用支持，但不做手势）。
