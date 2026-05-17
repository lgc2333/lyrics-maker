# Pre Phase 3：UI 布局与草图功能还原设计

## 1. 背景与目标

在正式进入 Phase 3（波形/频谱与网格系统）前，先完成一轮 **Pre Phase 3** 布局改造，目标是：

- 让当前 UI 结构贴近草图的信息层级与操作路径；
- 优先落地草图中的可实现交互（菜单、模式切换、Timing 控制区、状态高亮）；
- 不提前实现真正的波形/频谱渲染逻辑，避免和正式 Phase 3 方案冲突。

## 2. 范围定义

### 2.1 本次实现（In Scope）

- 顶部细化 MenuBar：左侧菜单骨架、中间标题、右侧亮暗切换（跟随系统默认）与模式切换 Switch。
- 模式切换样式为 Switch（带背景，选中模式高亮）。
- MainView 仅作为波形/频谱容器区与高度交互区（支持拖拽改高度）。
- 旧 `ModePanel` 拆分为：
  - `TimingPointsPanel`（时轴模式）
  - `LyricsPanel`（歌词模式）
- `TimingPointsPanel` 内落地草图核心能力：
  - Timing 列表多状态高亮（选中、播放到达、叠加）
  - 列表顶部靠右两个按钮：克隆选中时轴到此处、在此处添加时轴
  - Offset 输入框（单位 **s**，step 0.001，直接使用秒值，不经 ms 转换）
  - Set offset to current time 按钮
  - Offset ±微调按钮组
  - Tap BPM 按钮（详见 §4.5）与 BPM 输入框/微调
  - 拍号显示与编辑
- TransportBar 布局与行为细化（详见 §4.4）。
- 图标统一从 Iconify 引入，不使用 emoji。

### 2.2 本次不实现（Out of Scope）

- 真正的波形/频谱绘制与切换渲染。
- Phase 3 网格线、分隔线密度切换、频率缩放算法。
- Tap BPM"演示状态面板"（草图右侧状态示意仅用于说明，不作为页面功能区）。

## 3. 页面结构设计

整体结构排列为：

1. `MenuBar`（更细）
2. `MainView`（纯波形/频谱容器区，占位 + 高度拖拽）
3. `TransportBar`（播放、时间、进度、音量）
4. `Workspace`（根据模式切换面板）
   - timing 模式：`TimingPointsPanel`
   - lyrics 模式：`LyricsPanel`

说明：`Workspace` 由 `AppShell` 负责挂载，具体分栏与控件排布在 `TimingPointsPanel` / `LyricsPanel` 内部实现。

## 4. 组件职责与边界

### 4.1 AppShell

- 管理 `editorMode: 'timing' | 'lyrics'`。
- 负责全局布局编排和组件挂载顺序。
- 不承载具体 timing/lyrics 业务控件细节。

### 4.2 MenuBar

- 左侧：文件/编辑/查看/帮助菜单骨架（click 打开，click-outside 关闭）。
- 中间：应用标题。
- 右侧：亮暗切换按钮（默认跟随系统）、模式切换 Switch（时轴/歌词，带背景，选中高亮）。
- 菜单项先提供占位行为，为后续功能接入预留。

### 4.3 MainView

- 保持单一职责：主可视区域容器。
- 提供高度拖拽交互：
  - 默认高度约 250px；
  - 最小/最大高度限制（180px–520px），避免挤压其它区域；
  - 只改变容器尺寸，不耦合渲染逻辑。

### 4.4 TransportBar

布局从左到右固定顺序：

> 节拍器开关 · 吸附开关 | 快退（上一小节）· 播放/暂停 · 快进（下一小节）| 时间/进度条 | 音乐音量 · 音效音量

详细行为：

- **播放/暂停图标**随 `isPlaying` 状态实时切换（`isPlaying` 通过独立 `ref<boolean>` 跟踪，不通过 shallowRef computed）。
- **快退/快进**：跳到上/下一个小节起始时间点，而非固定时长位移。
- **时间显示**：格式 `MM:SS.mmm / MM:SS.mmm`，完整占满进度条左侧。
- **进度条**顶满 TransportBar 剩余宽度。
- **节拍器按钮**只有两种显示状态：开（`btn-active`）与关；`latch_pending` 对外视为关。
- **音量滑条**：使用 `absolute` 定位脱离 flex 流，`w-{N}` 等于容器 `h-{N}`，-rotate-90 后视觉高度填满容器，避免被压缩；hover 弹出，支持拖拽与滚轮调节（±0.05/格）；顶部显示当前音量百分比。

### 4.5 TimingPointsPanel

内部分为两栏：

**左栏：TimingPoints 列表**

- 行列显示：时间（`MM:SS.mmm`，用 `Math.round` 而非 `Math.floor` 转毫秒）、BPM、拍号、删除按钮。
- 三态行：`selected`（用户选中）、`active`（当前播放位置）、`selected+active`；active 状态用左侧 3px 竖条指示，而非整行背景高亮。
- 列表顶部靠右：「克隆选中时轴到此处」、「在此处添加时轴」两个按钮。

**右栏：Timing 控制区**

- **Offset 区**：
  - 输入框（`type="number"`, `step="0.001"`, 单位 `s`，直接以秒值读写，不经 ms 换算）
  - Set offset to current time 按钮
  - ±10s / ±5s / ±2s / ±1s 微调按钮组
- **BPM 区**：
  - BPM 输入框（`type="number"`, `step="0.1"`, min 1）
  - Tap BPM 按钮：三种标签/颜色状态：
    - 0 次：`"Tap to get BPM! (M)"`，默认样式
    - 1–8 次：`"Tap" + ".".repeat(9 - count)`，`btn-warning`
    - ≥9 次：`"${bpm.toFixed(1)} BPM / ${count} Taps"`，`btn-success`
  - 无音频加载时禁用 Tap BPM 按钮（防止 Infinity BPM）
  - ±1 / ±0.5 / ±0.2 / ±0.1 BPM 微调按钮组
- **拍号区**：分子/分母输入框。

**节拍器行为（store 层）**：

- `toggleMetronome` 只在**播放中**关闭时才进入 `latch_pending`（让最后一拍响完再停）；暂停状态下关闭直接变 `off`。
- `pausePlayback` / `togglePlayback`（暂停路径）自动将 `latch_pending` 清回 `off`。
- `tapCount` 在每次 `tapBpm()` 调用时**立即**（第一个 await 之前）递增，保证响应式更新同步可见。
- 1.5s 无新 tap 后自动重置 `tapCount` / `tapEstimatedBpm` 状态。

### 4.6 LyricsPanel

- 先提供与 timing 同级的布局骨架和基础控件占位。
- 保证模式切换后页面结构稳定，不提前实现歌词打轴深功能。

## 5. 状态与数据流

### 5.1 复用状态

- 使用 `useEditorStore` 作为业务状态来源（播放、时间、timing points、音量、tap 数据）。
- 遵守"UI 不直接改数据，统一通过 store action/command"约束。

### 5.2 新增 UI 层状态

- `editorMode`：放在 `AppShell`（后续若有全局需求可迁移到 store）。
- `selectedTimingPointId`：放在 `TimingPointsPanel`。
- `mainViewHeight`：放在 `MainView`，用于拖拽高度。

### 5.3 列表高亮计算

- `activeTimingPointId` 来源：store 已有 computed。
- 行状态由 `selectedTimingPointId` 与 `activeTimingPointId` 联合推导。
- active 行使用 `::before` 伪元素（`position: absolute; left: 0; width: 3px; height: 100%`），li 需有 `position: relative`。

## 6. 错误处理策略

- 不引入 silent fallback：
  - 当 timing 点为空或数据异常时，显示明确空态文案；
  - 操作失败沿用 store 既有错误反馈路径（`lastError`）。
- 不使用 broad try/catch 吞错。

## 7. 测试与验收

本次以"布局与交互可用"验收：

- `AppShell`：模式切换后正确挂载 `TimingPointsPanel`/`LyricsPanel`。
- `MainView`：拖拽可改变高度并受边界约束。
- `TimingPointsPanel`：列表状态高亮正确反映 selected/active/叠加状态；Tap BPM 三态标签与 disable 逻辑。
- `Timing 控制区`：按钮触发 store action，关键数值显示与 store 同步；Offset 以秒精确读写。
- `MenuBar`：菜单可点击展开，主题切换（跟随系统）与模式 Switch 可操作。

## 8. 与正式 Phase 3 的衔接

- 本设计是 **Pre Phase 3**，优先把页面框架、分区和交互骨架稳定下来。
- 正式 Phase 3 将在该布局上接入：
  - 波形/频谱渲染
  - 网格与播放头同步
  - 分隔线密度与频率缩放

## 9. 实现记录

- 2026-05-17: Pre Phase 3 layout refresh 实现完成。MenuBar 采用 click 打开菜单，支持 click-outside-close；TransportBar 按严格从左到右顺序排列控件，音量使用 hover 弹出竖向滑条；TimingPointsPanel 支持 selected/active/combined 三态行高亮；MainView 支持拖拽缩放高度（180px–520px）。MenuBar 菜单项当前为占位，待后续 Phase 接入实际操作。LyricsPanel 为骨架占位，待 Phase 4 接入歌词编辑功能。
- 2026-05-17（修复轮）：修复 isPlaying 响应式（独立 ref）；修复 TimingPointsPanel Offset 单位（s）与精度（Math.round）；Tap BPM 三态标签 + tapCount 前置递增；节拍器 2 态按钮 + 暂停时不 latch；音量竖向滑条改用 absolute 定位修复旋转后尺寸；移除 setOffsetFromMs 函数，统一以秒读写。
