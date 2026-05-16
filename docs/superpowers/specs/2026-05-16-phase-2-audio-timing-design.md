# Phase 2 音频与时轴核心设计

## 1. 背景与目标

Phase 1 已完成基础设施（Command、Store、Persistence、Shortcut、Shell）。  
本阶段目标是在既有三层架构中落地音频与时轴核心能力，覆盖：

- 音频导入、播放/暂停、当前时间同步
- Timing Point 的新增/编辑/删除
- TAP BPM（按钮 + `B` 键）
- 节拍器与音乐严格同步（小节首拍重音，含收尾提示音规则）
- 音乐与节拍器音效的独立音量控制

本阶段强调**功能还原**，不追求 osu! editor 的视觉还原。

## 2. 明确范围

### 2.1 In Scope（Phase 2）

- 每个 Timing Point 同时包含：`time`、`bpm`、`timeSignatureNumerator`、`timeSignatureDenominator`、`offsetMs`
- Timing Point 按时间分段生效：从自身开始到下一个 point 之前
- 第一个 Timing Point 之前的前导区，使用第一个 point 参数做反向推算
- TAP BPM：用户可点击按钮或按 `B` 连续敲击；敲击次数 `> 8` 后，估算 BPM 实时应用到当前活动 Timing Point
- 暂停状态下触发 TAP 时，自动从当前 Timing Point 起点播放
- Offset 是 Timing Point 属性（非全局属性）
- 节拍器仅在播放时发声，且必须和分段拍点严格同步；每小节首拍使用重音；关闭后按 `latch` 规则收尾
- 音乐音量（Audio Transport）与音效音量（Metronome）可独立调节

### 2.2 Out of Scope（留到 Phase 3）

- 时间线右侧缩放按钮
- 分隔线密度切换（`1/4`、`1/8` 等）与 `common / triplets` 切换（`1/3`、`1/6` 等）
- 波形/频谱可视化与网格渲染体系

## 3. 架构方案

### 3.1 Core（纯计算）

新增 `src/core/timing/*`：

- `timing-point.ts`：Timing Point 类型与基础校验（BPM > 0、拍号 > 0、offset 范围）
- `timing-engine.ts`：分段查询、前导区反推、拍点/小节线计算、当前 active point 解析
- `tap-bpm.ts`：敲击缓冲与 BPM 估算（间隔过大重置、采样上限、稳定估算）

Core 不依赖 Vue/DOM/Audio API。

### 3.2 Platform（适配层）

新增 `src/platform/audio/*`：

- `audio-transport.ts`：音频加载、播放/暂停、currentTime 读取、事件桥接
- `metronome.ts`：基于 WebAudio 的点击音调度器；支持重音与 `latch` 收尾策略

Platform 可依赖浏览器 API，但不依赖 Vue。

### 3.3 Store/UI（应用层）

在 `editor-store` 新增时轴会话状态：

- `mode`、`isPlaying`、`currentTime`
- `timingPoints`、`activeTimingPointId`
- TAP 状态（最近敲击、估算 BPM）
- 节拍器开关状态

UI 继续作为薄层，触发 store action / command，不直接做时轴计算。

## 4. 关键行为定义

### 4.1 Timing Point 生效规则

1. 按时间排序后，`point[i]` 对区间 `[point[i].time, point[i+1].time)` 生效
2. 当 `t < firstPoint.time`，使用首 point 的参数做反推（保证前导区网格连续）
3. 当前活动 point 由 `currentTime` 查询得到

### 4.2 TAP BPM 规则

1. 触发来源：按钮或 `B` 键
2. 敲击写入时间戳序列；当样本数 `> 8` 时开始稳定应用
3. 估算值实时写回当前活动 Timing Point 的 BPM
4. 若当前暂停，则先将播放头定位到当前活动 Timing Point 起点并自动播放，再继续跟拍

### 4.3 Offset 规则

- `offsetMs` 参与该 point 分段内的拍线相位计算
- 修改某 point 的 offset 仅影响其覆盖区间，不跨段污染

### 4.4 节拍器规则

1. 节拍器只在 `isPlaying = true` 时调度
2. 每个小节第一拍发重音，其余发轻音
3. `toggle off` 时不截断当前正在发声的拍点
4. 关闭后默认在“下一拍点”播放一个 `latch` 收尾提示音，然后停止后续全部调度
5. 若 `latch` 触发前用户重新开启节拍器，则取消该 `latch`

### 4.5 音量控制规则

1. 音乐音量与音效音量分离管理（互不覆盖）
2. 音乐音量作用于音频播放通道
3. 音效音量作用于节拍器发声通道（包含重拍、轻拍、latch）

## 5. 测试策略

1. **Core 单测（优先）**
   - 分段生效边界
   - 前导区反推
   - offset 对拍点影响
   - 小节首拍识别
   - TAP 估算与采样阈值逻辑
2. **Store 单测**
   - TAP 应用到 active point
   - 暂停 TAP 自动起播
   - point 增删改与 active point 切换
3. **组件交互测试**
   - Timing Points 列表增删改入口
   - TAP 按钮/快捷键触发链路
   - 播放/暂停与状态联动

## 6. 验收标准

- 可导入音频并稳定播放/暂停，`currentTime` 与 UI 同步
- Timing Point 支持新增/编辑/删除且分段计算正确
- TAP BPM 在样本数 > 8 后实时应用到当前 point
- 节拍器在播放时与音乐拍点同步，且小节首拍重音明显
- 关闭节拍器时允许当前拍点自然结束，并按规则处理 `latch`
- 音乐音量与音效音量可分别调节并即时生效

## 7. 实现备注（Post-Hotfix）

- editor-store 在播放中通过 RAF 循环同步 currentTime
- "在此添加 Timing Point" 使用实时 currentTime，不再固定 0.0s
- TransportBar 新增播放进度条（展示 currentTime/duration，支持拖动 seek）
- Metronome 点击音源来自 /public/assets 三个 WAV 文件
- TAP BPM 写回 Timing Point 时四舍五入为整数
