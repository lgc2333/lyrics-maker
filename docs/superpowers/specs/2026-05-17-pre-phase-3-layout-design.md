# Pre Phase 3：UI 布局与草图功能还原设计

## 1. 背景与目标

在正式进入 Phase 3（波形/频谱与网格系统）前，先完成一轮 **Pre Phase 3** 布局改造，目标是：

- 让当前 UI 结构贴近草图的信息层级与操作路径；
- 优先落地草图中的可实现交互（菜单、模式切换、Timing 控制区、状态高亮）；
- 不提前实现真正的波形/频谱渲染逻辑，避免和正式 Phase 3 方案冲突。

## 2. 范围定义

### 2.1 本次实现（In Scope）

- 顶部细化 MenuBar，提供可点击菜单骨架（文件/编辑/查看/帮助）。
- 顶部提供主题切换按钮与模式切换（时轴/歌词）。
- MainView 仅作为波形/频谱容器区与高度交互区（支持拖拽改高度）。
- 旧 `ModePanel` 拆分为：
  - `TimingPointsPanel`（时轴模式）
  - `LyricsPanel`（歌词模式）
- `TimingPointsPanel` 内落地草图核心能力：
  - Timing 列表多状态高亮（选中、播放到达、叠加）
  - Offset 显示与微调按钮
  - Tap BPM 按钮与 BPM 显示/微调
  - 拍号显示与编辑入口
  - 在当前时间插入/克隆 timing 点入口
- TransportBar 调整布局层级与信息密度，使其更接近草图结构。
- TransportBar 交互细化：
  - 从左到右固定顺序：节拍器开关 / 吸附开关 / 分隔线 / 播放控制（快退一小节、播放/暂停、快进一小节）/ 播放时间 / 进度条 / 音乐音量 / 音效音量。
  - 音量图标支持 hover 展开竖向滑条。
  - 音量图标支持滚轮调节（每格 ±0.05，范围 0~1）。
  - 音量滑条顶部显示当前音量百分比。

### 2.2 本次不实现（Out of Scope）

- 真正的波形/频谱绘制与切换渲染。
- Phase 3 网格线、分隔线密度切换、频率缩放算法。
- Tap BPM“演示状态面板”（草图右侧状态示意仅用于说明，不作为页面功能区）。

## 3. 页面结构设计

整体结构重排为：

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

- 展示应用标题、菜单骨架、主题切换、模式切换入口。
- 菜单采用 click 打开（符合需求文档约束）。
- 菜单项先提供占位行为（可触发 toast/提示），为后续功能接入预留。

### 4.3 MainView

- 保持单一职责：主可视区域容器。
- 提供高度拖拽交互：
  - 默认高度约 250px；
  - 最小/最大高度限制，避免挤压其它区域；
  - 只改变容器尺寸，不耦合渲染逻辑。

### 4.4 TransportBar

- 延续已有播放与进度逻辑（`togglePlayback`、`seekPlayback`、`currentTime`、`duration`）。
- 调整布局样式与控件分组，使信息结构更贴近草图。
- 详细布局与行为：
  - 左侧图标组：节拍器开关、吸附开关（图标按钮）。
  - 中段播放组：小节级前进/后退 + 播放暂停。
  - 时间与进度组：当前时间/总时长 + 可拖拽进度条。
  - 音量组：音乐/音效两个独立图标，hover 显示竖向滑条，支持拖拽与滚轮调节。
  - 竖向滑条顶部显示当前通道音量百分比（例如 `75%`）。

### 4.5 TimingPointsPanel

- 承载时轴模式主要工作区，内部分为：
  - 左：TimingPoints 列表
  - 右：Timing 控制区
- 列表状态规则：
  - `selected`: 用户当前选中 timing 点
  - `active`: 当前播放时间所在 timing 点
  - `selected + active`: 并存状态（特殊高亮）
- 控制区优先复用现有 store 能力：
  - `tapBpm`、`toggleMetronome`
  - `addTimingPoint`、`updateTimingPoint`
  - `currentTime`、`project.timingPoints`

### 4.6 LyricsPanel

- 先提供与 timing 同级的布局骨架和基础控件占位。
- 保证模式切换后页面结构稳定，不提前实现歌词打轴深功能。

## 5. 状态与数据流

### 5.1 复用状态

- 使用 `useEditorStore` 作为业务状态来源（播放、时间、timing points、音量、tap 数据）。
- 遵守“UI 不直接改数据，统一通过 store action/command”约束。

### 5.2 新增 UI 层状态

- `editorMode`：放在 `AppShell`（后续若有全局需求可迁移到 store）。
- `selectedTimingPointId`：放在 `TimingPointsPanel`。
- `mainViewHeight`：放在 `MainView`，用于拖拽高度。

### 5.3 列表高亮计算

- `activeTimingPointId` 来源：store 已有 computed。
- 行状态由 `selectedTimingPointId` 与 `activeTimingPointId` 联合推导。
- 渲染层使用互斥/叠加 class 规则，确保三种可见状态稳定。

## 6. 错误处理策略

- 不引入 silent fallback：
  - 当 timing 点为空或数据异常时，显示明确空态文案；
  - 操作失败沿用 store 既有错误反馈路径（`lastError`）。
- 不使用 broad try/catch 吞错。

## 7. 测试与验收

本次以“布局与交互可用”验收：

- `AppShell`：模式切换后正确挂载 `TimingPointsPanel`/`LyricsPanel`。
- `MainView`：拖拽可改变高度并受边界约束。
- `TimingPointsPanel`：列表状态高亮正确反映 selected/active/叠加状态。
- `Timing 控制区`：按钮触发 store action，关键数值显示与 store 同步。
- `MenuBar`：菜单可点击展开，主题切换与模式入口可操作。

## 8. 与正式 Phase 3 的衔接

- 本设计是 **Pre Phase 3**，优先把页面框架、分区和交互骨架稳定下来。
- 正式 Phase 3 将在该布局上接入：
  - 波形/频谱渲染
  - 网格与播放头同步
  - 分隔线密度与频率缩放

## 9. 实现记录

- 2026-05-17: Pre Phase 3 layout refresh 实现完成。MenuBar 采用 click 打开菜单，支持 click-outside-close；TransportBar 按严格从左到右顺序排列控件，音量使用 hover 弹出竖向滑条；TimingPointsPanel 支持 selected/active/combined 三态行高亮；MainView 支持拖拽缩放高度（180px–520px）。
- MenuBar 菜单项当前为占位，待后续 Phase 接入实际操作。
- LyricsPanel 为骨架占位，待 Phase 4 接入歌词编辑功能。
