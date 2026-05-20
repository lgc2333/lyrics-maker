# Phase 4：歌词打轴设计文档

## 1. 背景与目标

Phase 1–3 已完成基础设施、音频播放、波形/频谱视图与节拍网格。Phase 4 在此基础上实现歌词打轴能力：用户先输入歌词、切词，再跟随音乐逐词按 D 键标记时间点，最终生成逐词时间轴数据。

工作流（Aegisub 风格）：

1. 导入/粘贴歌词文本 → 自动按行拆分
2. 切词面板对每行切词（英文默认按空格，中文默认不拆）
3. 点击行 → seek 到该行起点 → 播放 → 按 D 逐词打轴 → Enter 结束当行进入下一行
4. 拖拽词块边界或数值面板进行微调

---

## 2. 数据模型变更

修改 `src/core/domain/project.ts`：

```ts
export interface LyricWord {
  id: string
  text: string
  endTime?: number // 该词的结束时间（秒）；词起点 = 上一词 endTime 或 line.startTime
}

export interface LyricLine {
  id: string
  text: string
  words: LyricWord[]
  startTime?: number // 句子起点（按 D 进入该行时设置）
}
```

**变更：** 原 `LyricWord` 的 `startTime` / `endTime` 双字段简化为仅保留 `endTime`；`LyricLine` 新增 `startTime`，移除 `endTime`（冗余，直接读 `words[last].endTime`）；`LyricLine.text` 字段保留不变。

词的起点由运行时推导：

```
words[i].startTime = i === 0 ? line.startTime : words[i-1].endTime
```

---

## 3. 组件结构

```
AppShell
├── MenuBar                  新增「歌词」菜单：粘贴歌词 / 导入文件 / 添加行
├── MainView                 波形层不变；歌词模式叠加 LineOverlay
│   └── LineOverlay          句子区间色块 + 词块分隔线，覆盖在波形上
├── TransportBar             不变
└── LyricsPanel              歌词模式下替换 TimingPointsPanel
    ├── LyricsLineList       行列表（行号 / startTime / 词块状态预览 / 三态高亮）
    └── WordSplitBar         切词 + 打轴面板，歌词模式下始终展示
        ├── 模式切换按钮      ✂️ 剪刀模式 / 👆 选中模式
        ├── 起始块 + 词块列表  剪刀模式：点击字符间隙插入/取消分割
        │                    选中模式：点击词块设置 activeWord
        └── 数值编辑区        仅选中模式 + 有 activeWord 时展示
                             显示当前词推导起点与 endTime 可编辑输入框
```

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

---

## 5. D 键与 Enter 键状态机

### 激活一行（点击 LyricsLineList 某行）

1. 设 `activeLineId = lineId`，`activeWordIndex = 0`
2. Seek 策略（优先级降级）：
   - 该行有 `startTime` → seek 到 `startTime`
   - 该行无 `startTime`，上一行有 `words[last].endTime` → seek 到那个时间
   - 否则 → 不 seek，保持播放头

### D 键逻辑

```
if activeWordIndex === N（最后词）:
  无操作

elif activeWordIndex === 0（起始块）:
  time = snapToGrid(currentTime)
  dispatch setLineStartTime(activeLineId, time)
  activeWordIndex = 1

else:
  wordIndex = activeWordIndex - 1
  time = snapToGrid(currentTime)

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

Enter 始终以当前播放时间完成整行，无论 activeWordIndex 在哪：

```
// 最后一行按 Enter → 无操作
if no nextLine: return

time = snapToGrid(currentTime)
dispatch setWordEndTime(activeLineId, words[last].id, time)
activeLineId = nextLine.id
activeWordIndex = 0
```

若 activeWordIndex 不在末尾（用户提前按 Enter 跳行），中间未打轴的词 endTime 保持 undefined，后续可补打。

---

## 6. Commands

新增于 `src/core/commands/project-commands.ts`：

| Command 工厂                                        | 说明                                 |
| --------------------------------------------------- | ------------------------------------ |
| `createSetLineStartTimeCommand(lineId, time)`       | 设置行 startTime                     |
| `createSetWordEndTimeCommand(lineId, wordId, time)` | 设置词 endTime                       |
| `createClearWordEndTimeCommand(lineId, wordId)`     | 清除词 endTime（越界时）             |
| `createSplitWordCommand(lineId, wordId, newId)`     | 切词：一词变两词（后词继承 endTime） |
| `createMergeWordsCommand(lineId, wordId)`           | 合并：当前词与下一词，取后者 endTime |
| `createInsertLyricLinesCommand(lines)`              | 粘贴/导入批量建行                    |
| `createRemoveLyricLineCommand(lineId)`              | 删除行                               |
| `createUpdateLyricLineTextCommand(lineId, text)`    | 编辑行文本                           |

每次 D / 切词 / 合并均为独立 Command，细粒度 undo。

### Store 新增 actions（`editor-store.ts`）

- `setLineStartTime(lineId, time)`
- `setWordEndTime(lineId, wordId, time)`
- `clearWordEndTime(lineId, wordId)`
- `splitWord(lineId, wordId, snapTime)` — 插入新词，中值吸附网格
- `mergeWords(lineId, wordId)` — 合并当前词与下一词
- `insertLyricLines(lines: LyricLine[])` — 粘贴/导入入口
- `removeLyricLine(lineId)`

---

## 7. WordSplitBar 交互细节

### 剪刀模式（✂️）

- 词块展开为独立字符卡片，字符间有可点击热区
- 点击热区 → 插入分隔线（`splitWord` command）
- 再次点击已有分隔线 → 取消分割（`mergeWords` command）
- 英文/空格分词语言：导入时默认按空格预切，其余语言整句不拆

### 选中模式（👆）

- 最前方有「起始块」（标记行起点）
- 点击任意块 → 设为 activeWord，WordSplitBar 底部展示数值编辑区
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

---

## 8. LineOverlay（波形叠加层）

歌词模式下，MainView 在波形/频谱上叠加一层 SVG/Canvas overlay：

- 有时间范围的句子：绘制半透明色块（区间 = startTime ~ words[last].endTime）
- 当前激活行：用高亮颜色区分
- 词块分隔线：每个词的 endTime 对应一条竖线，与网格线视觉区分

---

## 9. 歌词输入入口（MenuBar）

在 MenuBar 的「歌词」菜单中新增：

- **粘贴歌词** — 弹出 textarea，粘贴/输入后按换行拆分为多行 `LyricLine`，text 按语言默认切词
- **导入文件** — 支持 .txt（一行一句），Phase 5 扩展 LRC/ASS
- **添加行** — 在列表末尾插入空行

歌词列表为空时：LyricsLineList 显示空状态引导区（提示从 MenuBar 导入）。

---

## 10. 边界校验

所有时间写入经过统一校验：

- `time >= 0`
- `time <= audioDuration`
- `word.endTime > line.startTime`（或上一词 endTime）
- 拖拽边界：`words[i].endTime <= words[i+1].endTime`（硬限制，UI 层 clamp）

---

## 11. 测试重点

- `createSplitWordCommand` / `createMergeWordsCommand` do/undo 正确性
- `createSetWordEndTimeCommand` 越界清除逻辑
- `useLyricsEditor` 状态机：D 推进、暂停时 D 的 seek、Enter 换行、最后行 Enter 无操作
- 校验拒绝非法时间（负时长、超出音频、两端重合切分）
- `LineOverlay` 正确映射时间 → 像素坐标（复用 WaveSurfer scroll/zoom 参数）

---

## 12. 不在本阶段实现

- LRC / ASS / JSON 导入导出（Phase 5）
- 快捷键自定义 UI（Phase 5）
- 听打模式（边听边输入歌词）
- 多语言扩展（英文 i18n key 预留，文案暂 zh-CN）
