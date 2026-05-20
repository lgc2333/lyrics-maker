# Phase 4：歌词打轴设计文档

## 1. 背景与目标

Phase 1–3 已完成基础设施、音频播放、波形/频谱视图与节拍网格。Phase 4 在此基础上实现歌词打轴能力：用户先输入歌词、切词，再跟随音乐逐词按 D 键标记时间点，最终生成逐词时间轴数据。

工作流（Aegisub 风格）：

1. 导入/粘贴歌词文本 → 自动按行拆分
2. 切词面板对每行切词（英文默认按空格，中文默认不拆）
3. 点击行 → seek 到该行起点 → 播放 → 按 D 逐词打轴 → Enter 结束当行进入下一行
4. 拖拽词块边界或数值面板进行微调

**前置条件：必须已导入音频。** 未导入音频时歌词模式彻底禁用（模式切换按钮 disabled，快捷键不响应）。

---

## 2. 数据模型变更

修改 `src/core/domain/project.ts`：

```ts
export interface LyricWord {
  id: string // crypto.randomUUID() 生成
  text: string
  endTime?: number // 该词的结束时间（秒）；词起点 = 上一词 endTime 或 line.startTime
}

export interface LyricLine {
  id: string // crypto.randomUUID() 生成
  words: LyricWord[] // 始终非空，至少一个元素；未切词时整行文本作为单个 word
  startTime?: number // 句子起点（按 D 进入该行时设置）
}
```

**变更摘要：**

- `LyricWord`：去掉 `startTime`，仅保留 `endTime`
- `LyricLine`：去掉 `text`（由 `words[*].text` 拼接推导）、去掉 `endTime`（冗余，读 `words[last].endTime`）、新增 `startTime`
- **`words` 数组约束**：始终非空。空行也必须有一个空文本 word `{ id, text: '', endTime: undefined }`。导入/粘贴时每行至少创建一个 word
- ID 生成统一使用 `crypto.randomUUID()`

词的起点由运行时推导：

```
words[i].startTime = i === 0 ? line.startTime : words[i-1].endTime
```

行的文本由运行时推导：

```
line.text = words.map(w => w.text).join('')
```

---

## 3. 组件结构

```
AppShell
├── MenuBar                  新增「歌词」菜单：粘贴歌词 / 导入文件 / 添加行
├── MainView                 波形层不变；歌词模式叠加 LineOverlay
│   └── LineOverlay          自研 Canvas overlay（扩展 GridOverlayPlugin 模式）
│                            句子区间色块 + 词块分隔线，覆盖在波形上
│                            pointerEvents: 'none'，不拦截波形层交互
├── TransportBar             不变
└── LyricsPanel              歌词模式下替换 TimingPointsPanel
    ├── LyricsLineList       行列表（行号 / startTime / 词块状态预览 / 三态高亮）
    └── WordSplitBar         切词 + 打轴面板，歌词模式下始终展示
        ├── 模式切换按钮      ✂️ 剪刀模式 / 👆 选中模式
        ├── 起始块 + 词块列表  剪刀模式：点击字符间隙插入/取消分割
        │                    选中模式：点击词块设置 activeWord
        │                    三色词块：🟢已打轴 / 🔴当前目标词 / ⬛待打轴
        └── 数值编辑区        仅选中模式 + 有 activeWord 时展示
                             显示当前词推导起点与 endTime 可编辑输入框
```

**关于 WordTimelineBar（原需求文档 §4.4）：** 原需求设计了独立的三色词块条。经讨论确认，三色词块（🟢已打轴 / 🔴当前目标词 / ⬛待打轴）集成到 WordSplitBar 中，不再单独设 WordTimelineBar。波形上的句子/词块可视化由 LineOverlay 负责。

**LineOverlay 技术方案：自研 Canvas overlay。** 理由：

- 词级 region 数量多（一首歌可达 100+），DOM 方案性能不可控
- 需要 `pointerEvents: 'none'` 让波形层交互不被遮挡
- 未来可扩展渐进填充高亮
- 拖拽边界调整在 WordSplitBar 里完成，不需要波形层拖拽

实现模式参照 `GridOverlayPlugin`：继承 `BasePlugin`，注册在 WaveSurfer 实例上，监听 scroll/zoom/ready 事件重绘。

---

## 4. 会话状态：`useLyricsEditor`

新建 `src/composables/useLyricsEditor.ts`，在 `AppShell` 中实例化并 `provide` 给 LyricsPanel 子树。

```ts
interface LyricsEditorState {
  activeLineId: string | null
  activeWordIndex: number // 0 = 起始块(line.startTime), 1 = words[0].endTime, …
  splitBarMode: 'cut' | 'select'
}
```

**`activeWordIndex` 语义表：**

| index       | 操作目标                  |
| ----------- | ------------------------- |
| 0           | `line.startTime`          |
| 1           | `words[0].endTime`        |
| k           | `words[k-1].endTime`      |
| N（最后词） | 仅 Enter 可操作；D 无操作 |

> 注：`N = words.length`。由于 `words` 始终非空（至少 1 个元素），`activeWordIndex === 0` 始终指向 `line.startTime`（起始块），不存在 N=0 的歧义。

---

## 5. D 键与 Enter 键状态机

### `snapToNearestGridPoint` 工具函数

Spec 中所有 `snapToGrid(time)` 调用均指向一个需要新建的工具函数 `snapToNearestGridPoint(timingPoints, time, divisor, triplets)`，定义在 `src/core/timing/timing-engine.ts` 中。

与现有 `getNextSubdivisionTime`（只向后找下一个网格点）不同，`snapToNearestGridPoint` 需要找到当前时间**最近的**网格点（可能在前也可能在后），返回距离最小的那个。

### 激活一行（点击 LyricsLineList 某行）

1. 设 `activeLineId = lineId`，`activeWordIndex = 0`
2. Seek 策略（优先级降级）：
   - 该行有 `startTime` → seek 到 `startTime`
   - 该行无 `startTime`，上一行有 `words[last].endTime` → seek 到那个时间
   - 上一行有 `startTime` 但无 `words[last].endTime` → seek 到上一行 `startTime`
   - 否则 → 不 seek，保持播放头

### D 键逻辑

**前置 guard：** `if activeLineId === null: return`（无激活行时所有快捷键均无操作）。此 guard 适用于 D / Shift+D / Enter / C / V / Delete 所有歌词模式快捷键。

**重打轴规则：** D 键始终覆盖当前 `activeWordIndex` 指向的操作目标。无论该目标是否已有时间，一律用新时间覆盖。用户可在选中模式里点击任意词块（如第 3 个词，activeWordIndex=3），然后按 D 直接覆盖该词的 endTime。

```
if activeWordIndex === N（words.length，即超过最后词）:
  无操作

elif activeWordIndex === 0（起始块）:
  time = snapToGrid(currentTime)
  dispatch setLineStartTime(activeLineId, time)
  activeWordIndex = 1
  // 若处于暂停状态，开始播放

else:
  wordIndex = activeWordIndex - 1
  time = snapToGrid(currentTime)

  // 50ms 近距离吸附已移至 §12 统一描述，此处只做网格吸附 + 防重合

  // 越界检查：清除被跳过词的 endTime
  for k in (wordIndex+1 .. words.length-1):
    if words[k].endTime !== undefined && words[k].endTime <= time:
      dispatch clearWordEndTime(lineId, words[k].id)
    else:
      break

  dispatch setWordEndTime(activeLineId, words[wordIndex].id, time)
  activeWordIndex += 1
```

**暂停时按 D（activeWordIndex === 0）：**

- 行无 startTime → 以当前播放位置作为 startTime，开始播放，activeWordIndex = 1
- 行有 startTime → seek 到 startTime，开始播放，activeWordIndex = 1

**暂停时按 D（activeWordIndex > 0）：**

- 行 startTime 晚于当前播放进度 → 用当前进度覆盖 line.startTime，activeWordIndex 重置到 1
- 否则正常 D 逻辑，同时开始播放

### Enter 键逻辑

**Enter 会覆盖 words[last].endTime**（即使已有值），与 D 键重打轴规则一致。

```
// activeLineId === null → 无操作（由前置 guard 拦截）
// 最后一行按 Enter → 无操作
if no nextLine: return

// 当前行 startTime 未设置 → 不对当前行做任何操作，直接进入下一行
if line.startTime === undefined:
  activeLineId = nextLine.id
  activeWordIndex = 0
  return

time = snapToGrid(currentTime)
dispatch setWordEndTime(activeLineId, words[last].id, time)
activeLineId = nextLine.id
activeWordIndex = 0
```

若 activeWordIndex 不在末尾（用户提前按 Enter 跳行），中间未打轴的词 endTime 保持 undefined，后续可补打。

### Shift+D 键逻辑（打轴但不前进）

与 D 键相同的时间标记逻辑，但 **不递增 activeWordIndex**。用于精确调整当前词的 endTime 而不推进到下一词。

```
if activeWordIndex === 0:
  同 D 键（设 startTime），但 activeWordIndex 保持 0 不变
elif activeWordIndex === N:
  无操作
else:
  wordIndex = activeWordIndex - 1
  time = snapToGrid(currentTime)
  // 越界检查同 D 键
  dispatch setWordEndTime(activeLineId, words[wordIndex].id, time)
  // 不递增 activeWordIndex
```

### C 键逻辑（播放当前句子区间）

从当前句子 `startTime` 开始播放，到 `words[last].endTime` 停止。若行无时间则无操作。

### V 键逻辑（播放当前词区间）

从当前词的推导起点开始播放，到当前词 `endTime` 停止。若词无时间则无操作。

### Delete 键逻辑（删除当前行）

删除 `activeLineId` 指向的行（含所有词和时间数据），激活下一行（若无则激活上一行，若列表为空则 `activeLineId = null`）。

---

## 6. Undo/Redo 与 activeWordIndex 同步

D 键产生 Command（data 层），同时 activeWordIndex++（UI 层 composable）。Undo 时 data 层回滚但 UI 状态不自动跟随。

**方案：Undo/Redo 后从数据推导 activeWordIndex。**

`useLyricsEditor` 监听 store 的 undo/redo 事件（或 watch project state 变化），在回调中：

1. 如果 `line.startTime === undefined` → `activeWordIndex = 0`
2. 否则扫描当前行 words，找到第一个 `endTime === undefined` 的词，`activeWordIndex = 该词 index + 1`
3. 如果所有词都有 endTime → `activeWordIndex = N`（全部完成态）

Redo 同理，正向推导。**不需要在 Command 里存 activeWordIndex 快照**，纯粹从数据状态推导 UI 位置。

---

## 7. Commands

新增于 `src/core/commands/project-commands.ts`：

| Command 工厂                                               | 说明                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSetLineStartTimeCommand(lineId, time)`              | 设置行 startTime                                                                                                                                                                                                                                                                                                |
| `createSetWordEndTimeCommand(lineId, wordId, time)`        | 设置词 endTime                                                                                                                                                                                                                                                                                                  |
| `createClearWordEndTimeCommand(lineId, wordId)`            | 清除词 endTime（越界时）                                                                                                                                                                                                                                                                                        |
| `createSplitWordCommand(lineId, wordId, charIndex, newId)` | 切词：在字符位置一词变两词（后词继承 endTime）。`charIndex` 使用 `String.prototype.slice` 语义：前半段 = `text.slice(0, charIndex)`，后半段 = `text.slice(charIndex)`。例如 `"hello"` 在 `charIndex=2` → `["he", "llo"]`。**校验：`0 < charIndex < text.length`**，等于 0 或 text.length 会产生空文本词，应拒绝 |
| `createMergeWordsCommand(lineId, wordId)`                  | 合并：当前词与下一词，取后者 endTime                                                                                                                                                                                                                                                                            |
| `createInsertLyricLinesCommand(lines)`                     | 粘贴/导入批量建行（追加到末尾）                                                                                                                                                                                                                                                                                 |
| `createRemoveLyricLineCommand(lineId)`                     | 删除行                                                                                                                                                                                                                                                                                                          |

每次 D / 切词 / 合并均为独立 Command，细粒度 undo。

**ID 生成：** 所有新建的 `LyricLine.id` 和 `LyricWord.id` 统一使用 `crypto.randomUUID()`。ID 在 Command 工厂调用方（composable / store action）生成后传入 Command，确保 undo/redo 的 ID 稳定。

### Store 新增 actions（`editor-store.ts`）

- `setLineStartTime(lineId, time)`
- `setWordEndTime(lineId, wordId, time)`
- `clearWordEndTime(lineId, wordId)`
- `splitWord(lineId, wordId, charIndex, snapTime)` — 插入新词，中值吸附网格
- `mergeWords(lineId, wordId)` — 合并当前词与下一词
- `insertLyricLines(lines: LyricLine[])` — 粘贴/导入入口，追加到末尾
- `removeLyricLine(lineId)`

---

## 8. WordSplitBar 交互细节

### 剪刀模式（✂️）

- 词块展开为独立字符卡片（每个字符包括空格独立显示），字符间有可点击热区
- 点击字符间热区 → 插入分隔线（`splitWord` command，在点击位置的字符 index 处拆分）
- 再次点击已有分隔线 → 取消分割（`mergeWords` command）
- 手动切词给用户每个字符（包括空格）的决定权
- 单字符 word 无法再切（字符间无间隙），这是预期行为
- 三色词块指示状态：🟢已打轴（有 endTime）/ 🔴当前目标词（activeWord）/ ⬛待打轴（无 endTime）

### 自动切词规则

- 英文等使用空格做语义分割的语言：按空格拆分，每个空格分隔的 token 作为一个 word
- 中文、日文等无空格分隔的语言：不自动拆分，整行作为一个 word
- **触发时机**：仅在歌词导入/粘贴时自动执行一遍，无快捷键入口

### 选中模式（👆）

- 最前方有「起始块」（标记行起点），点击设为 activeWord（index=0）
- 点击任意词块 → 设为 activeWord，WordSplitBar 底部展示数值编辑区
- 数值编辑区显示：推导起点（只读）+ endTime（可编辑输入框）
- 为未来热键预留接口（`selectPrevWord` / `selectNextWord`）

### 插入切分中值插值

已有时间的行，在词 A（endTime=t1）和词 B（endTime=t2）之间插入新切分：

- 新词 endTime = `snapToGrid((t1 + t2) / 2)`
- 若吸附后与 t1 或 t2 相等则拒绝切分（两端重合无意义）

### 合并词

`mergeWords(lineId, wordId)` 合并 words[i] 和 words[i+1]：

- 合并后词 text = words[i].text + words[i+1].text
- 合并后词 endTime = words[i+1].endTime（丢弃 words[i].endTime）
- **校验：wordId 不能是最后一个词**（无下一词可合并），应拒绝
- **校验：合并后 words 数组不能变空**（但实际上只有两个词合并成一个时 words.length 从 2 变 1，始终 ≥ 1，不会违反非空约束）

---

## 9. LineOverlay（波形叠加层）

歌词模式下，MainView 在波形/频谱上叠加一层 Canvas overlay：

- **技术方案**：自研 Canvas overlay，继承 `BasePlugin`，模式参照 `GridOverlayPlugin`
  - 注册在 WaveSurfer 实例上，监听 scroll/zoom/ready 事件重绘
  - `pointerEvents: 'none'`，不拦截波形层交互
  - 支持 waveform 和 spectrogram 两种模式
- **绘制内容**：
  - 有时间范围的句子：绘制半透明色块（区间 = startTime ~ words[last].endTime）
  - 当前激活行：用高亮颜色区分
  - 词块分隔线：每个词的 endTime 对应一条竖线，与网格线视觉区分

---

## 10. 歌词输入入口（MenuBar）

在 MenuBar 的「歌词」菜单中新增：

- **粘贴歌词** — 弹出 textarea，粘贴/输入后按换行拆分为多行 `LyricLine`，每行自动执行一遍切词（按空格分词语言拆分，其余不拆），追加到已有歌词列表末尾
- **导入文件** — 支持 .txt（一行一句），Phase 5 扩展 LRC/ASS。追加到已有歌词列表末尾
- **添加行** — 在列表末尾插入空行（包含一个空文本 word）

歌词列表为空时：LyricsLineList 显示空状态引导区（提示从 MenuBar 导入）。有内容后入口仅保留在 MenuBar 中。

---

## 11. LyricsLineList 行状态

行的视觉状态与时轴模式 TimingPointList 一致：

| 状态                | 含义             | 视觉表现            |
| ------------------- | ---------------- | ------------------- |
| `selected`          | 用户点击选中     | 背景高亮            |
| `active`            | 当前播放位置所在 | 左侧 3px 竖条指示   |
| `selected + active` | 选中且播放位置   | 背景高亮 + 左侧竖条 |

---

## 12. 吸附规则

### 全局吸附开关

TransportBar 的磁铁按钮控制吸附开关（snap enabled）。**吸附关闭时，D / Shift+D / Enter 标记的时间直接使用 currentTime 原始值，不做任何网格吸附或防重合处理。** 仅在吸附开启时执行以下规则。

Spec 中所有 `snapToGrid(time)` 调用均隐含 `if snapEnabled` 前置条件。

### 网格吸附 + 防重合

吸附开启时，D 键标记时间的完整流程：

1. **网格吸附**：`candidateTime = snapToNearestGridPoint(currentTime)`
2. **防重合检查**：以当前网格间距的 **1/4** 为搜索半径（`radius = gridInterval / 4`），在 `[candidateTime - radius, candidateTime + radius]` 范围内寻找满足以下条件的网格点：
   - 该网格点上没有任何词的 endTime 占据（判断阈值：差距 < 1ms 视为已占据）
   - 优先选距 candidateTime 最近的
3. **结果**：
   - 找到未占据的网格点 → 吸附到该点
   - 未找到 → 不吸附，保留 currentTime 原始值

目的：快速连按 D 时，避免相邻词 endTime 吸附到同一个网格点导致重合，同时不把时间推到过远的位置。

---

## 13. 边界校验

所有时间写入经过统一校验：

- `time >= 0`
- `time <= audioDuration`
- `word.endTime > line.startTime`（或上一词 endTime）。若违反（极端情况：吸附关闭时快速连按 D），强制 clamp 到 `prevEndTime + 0.001`（1ms）兜底，保证时间单调递增
- 拖拽边界：`words[i].endTime <= words[i+1].endTime`（硬限制，UI 层 clamp，严格禁止拖过）

---

## 14. 测试重点

- `createSplitWordCommand` / `createMergeWordsCommand` do/undo 正确性
- `createSetWordEndTimeCommand` 越界清除逻辑
- `useLyricsEditor` 状态机：D 推进、暂停时 D 的 seek、Enter 换行、最后行 Enter 无操作
- Shift+D 打轴不前进
- Undo/Redo 后 activeWordIndex 正确推导
- 校验拒绝非法时间（负时长、超出音频、两端重合切分）
- words 数组非空约束
- `LineOverlay` 正确映射时间 → 像素坐标（复用 WaveSurfer scroll/zoom 参数）
- 无音频时歌词模式禁用

---

## 15. 不在本阶段实现

- LRC / ASS / JSON 导入导出（Phase 5）
- 快捷键自定义 UI（Phase 5）
- 听打模式（边听边输入歌词）
- 多语言扩展（英文 i18n key 预留，文案暂 zh-CN）
- 批量歌词编辑面板（需求文档 §3.5 的右侧文本编辑区 + 行号匹配 diff，暂搁置）
