# Phase 5 Plus Part 7 Post 导入导出后需求设计

## 背景

Part 7 已经建立 TXT/LRC/TTML/ASS/SRT/VTT 的歌词导入导出架构和文件交互流程。后续使用中发现，当前实现把三类 LRC 都折叠在同一个 `lrc` 格式里，菜单也把所有导出格式平铺展示，导致用户无法明确选择普通逐行 LRC、增强 LRC 或 ESLyric，也无法在导入确认时看到更准确的 LRC 类型。

本设计补齐 Part 7 后需求，不改变项目歌词数据模型，不改变 core/parser Vue-free 边界。

## 目标

- 文件菜单中的歌词导出改为二级菜单，并支持 hover 打开。
- 导出菜单能明确提示信息损失：
  - TXT 会损失所有时间轴信息。
  - 普通逐行 LRC、SRT、VTT 会损失逐词时间轴信息。
- LRC 在用户可见层面拆分为三种格式：
  - 普通逐行 LRC。
  - 增强 LRC：尖括号逐词时间戳，后缀仍为 `.lrc`。
  - ESLyric：方括号逐词时间戳，后缀仍为 `.lrc`。
- 导入 LRC 文件时，确认框显示识别出的 LRC 子类型，而不是统一显示 LRC。
- 增强 LRC 和 ESLyric 支持尾部时间戳标记该行结束。
- 普通逐行 LRC 导出时，可以用空行时间戳表达上一行结束时间。
- 导入三种 LRC 时，空行时间戳可以作为上一行结束时间；如果无法用于上一行结束，则忽略该空行。

## 非目标

- 不新增项目歌词数据字段。
- 不改变 `.lrc` 文件扩展名。
- 不实现歌词追加、合并或多文件批量导入。
- 不让 UI 层直接解析 LRC 内容。
- 不改变 TTML/ASS/SRT/VTT 的 core adapter 基本结构，除非为了统一导出目标类型必须调整调用签名。

## 类型与边界设计

继续保留 `LyricsFormatId` 作为真实 adapter 格式：

```ts
type LyricsFormatId = 'txt' | 'lrc' | 'ttml' | 'ass' | 'srt' | 'vtt'
```

新增面向用户和菜单的导出目标类型：

```ts
type LyricsExportTargetId =
  | 'txt'
  | 'lrc-line'
  | 'lrc-enhanced'
  | 'lrc-eslyric'
  | 'ttml'
  | 'ass'
  | 'srt'
  | 'vtt'
```

新增 LRC 子类型：

```ts
type LrcFlavor = 'line' | 'enhanced' | 'eslyric'
```

导入检测结果应能携带用户可见格式信息：

```ts
type DetectedFileKind =
  | { kind: 'project' }
  | {
      kind: 'lyrics'
      format: LyricsFormatId
      displayFormat: LyricsDisplayFormatId
      lrcFlavor?: LrcFlavor
    }
  | { kind: 'unsupported' }
```

`format` 仍用于选择 core adapter；`displayFormat` 用于确认框、本地化文案和状态提示。

## LRC 子类型识别

LRC 内容识别在 core 层完成，保持 Vue-free。

识别优先级：

1. 行内出现尖括号时间戳 `<mm:ss.xxx>`：识别为增强 LRC。
2. 行时间戳后正文中出现方括号时间戳，且不是普通多时间标签复用同一句歌词：识别为 ESLyric。
3. 其他 LRC：识别为普通逐行 LRC。

需要避免把普通多时间标签误判成 ESLyric：

```txt
[00:01.000][00:02.000]同一句歌词
```

这类写法仍按普通逐行 LRC 处理。ESLyric 更明确的特征是行时间戳后已经有可见文本，再出现方括号词时间戳：

```txt
[00:01.000]你[00:01.300]好
```

## LRC 导入语义

### 普通逐行 LRC

普通歌词行导入为 `line.startTime` 加无逐词 timing 的 words。

如果普通歌词行后紧跟空行时间戳，则空行时间戳作为上一行最后一个 word 的 `endTime`，空行本身不生成歌词行：

```txt
[00:12.000]你好
[00:13.000]
```

导入结果保留行尾边界：

```ts
{
  startTime: 12,
  words: [
    { text: '你' },
    { text: '好', endTime: 13 },
  ],
}
```

如果空行时间戳前面没有可承接的歌词行，或上一行已经有显式结束时间，则忽略该空行。

### 增强 LRC

增强 LRC 使用尖括号时间戳表示后续片段开始时间：

```txt
[00:12.000]<00:12.000>你<00:12.300>好
```

如果尾部存在尖括号时间戳且后面没有文本，该时间戳只作为上一片段的结束时间，不生成空文本 word：

```txt
[00:12.000]<00:12.000>你<00:12.300>好<00:13.000>
```

导入为：

```ts
{
  startTime: 12,
  words: [
    { text: '你', endTime: 12.3 },
    { text: '好', endTime: 13 },
  ],
}
```

如果没有尾部结束时间，且下一条有效记录是空行时间戳，则空行时间戳作为最后一个词的结束时间，空行本身忽略。

如果没有尾部结束时间，也没有可使用的空行时间戳，则继续使用既有 fallback：下一行 startTime、音频时长、片段开始后 1 秒。

### ESLyric

ESLyric 使用方括号时间戳表示后续片段开始时间：

```txt
[00:12.000]你[00:12.300]好
```

尾部方括号时间戳按增强 LRC 相同规则处理：

```txt
[00:12.000]你[00:12.300]好[00:13.000]
```

导入为：

```ts
{
  startTime: 12,
  words: [
    { text: '你', endTime: 12.3 },
    { text: '好', endTime: 13 },
  ],
}
```

如果 ESLyric 行没有尾部结束时间，但后面紧跟空行时间戳，则把空行时间戳作为该行最后一个词的结束时间。

## LRC 导出语义

导出目标通过 `LyricsExportTargetId` 传入 UI 和 persistence 层，再映射到 `lrcAdapter.export()` 的选项。

- `lrc-line`：普通逐行 LRC。
- `lrc-enhanced`：增强 LRC，使用尖括号逐词时间戳。
- `lrc-eslyric`：ESLyric，使用方括号逐词时间戳。

三种 LRC 导出文件后缀均为 `.lrc`。

### 普通逐行 LRC 导出

普通逐行 LRC 输出行起点：

```txt
[00:12.000]你好
```

如果歌词行有可用的最终 `lineEndTime`，普通逐行 LRC 可以额外输出一条空行时间戳表达该行结束：

```txt
[00:12.000]你好
[00:13.000]
```

该空行结束时间只用于普通逐行 LRC 导出。增强 LRC 和 ESLyric 应优先用尾部内联时间戳表达行结束。

### 增强 LRC 导出

逐词 timing 完整时，输出每个词的起始时间戳，并在尾部输出该行结束时间戳：

```txt
[00:12.000]<00:12.000>你<00:12.300>好<00:13.000>
```

如果逐词 timing 不完整，需要降级或拒绝导出。当前更推荐降级到普通行级内容前先给出明确状态提示，避免用户误以为导出了完整逐词 timing。

### ESLyric 导出

逐词 timing 完整时，输出方括号逐词时间戳，并在尾部输出该行结束时间戳：

```txt
[00:12.000]你[00:12.300]好[00:13.000]
```

逐词 timing 不完整时按增强 LRC 同样策略处理。

## 菜单设计

文件菜单保留“导入歌词文件...”。

文件菜单新增“导出歌词为”父菜单项，hover 后显示二级菜单。二级菜单包含：

- TXT（会损失所有时间轴信息）
- 普通逐行 LRC（会损失逐词时间轴信息）
- 增强 LRC
- ESLyric
- TTML
- ASS
- SRT（会损失逐词时间轴信息）
- VTT（会损失逐词时间轴信息）

二级菜单行为：

- 文件菜单打开后，hover “导出歌词为”展开二级菜单。
- 鼠标移到其他文件菜单项时关闭二级菜单。
- 点击二级菜单项后关闭所有菜单，并 emit 对应 `LyricsExportTargetId`。
- 点击外部关闭所有菜单。
- 顶级菜单 hover 切换行为保持现有体验。

## 本地化

新增或调整 i18n key：

- 导出父菜单项：`shell.menu.exportLyrics`
- 各导出目标显示名：`lyrics.export.formats.*`
- 信息损失提示：
  - `lyrics.export.loss.allTiming`
  - `lyrics.export.loss.wordTiming`
- 导入确认格式名：
  - `lyrics.import.formats.lrcLine`
  - `lyrics.import.formats.lrcEnhanced`
  - `lyrics.import.formats.lrcEslyric`

增强 LRC 和 ESLyric 的名称必须可本地化。ESLyric 可保留英文品牌式名称。

## 测试策略

### Core

- LRC flavor detection：
  - 普通逐行 LRC。
  - 普通多时间标签复用同一句，不误判为 ESLyric。
  - 增强 LRC。
  - ESLyric。
- LRC 导入：
  - 普通 LRC 空行时间戳作为上一行结束时间。
  - 普通 LRC 无法承接的空行被忽略。
  - 增强 LRC 尾部尖括号时间戳作为最后词结束时间，不生成空 word。
  - ESLyric 尾部方括号时间戳作为最后词结束时间，不生成空 word。
  - 增强 LRC/ESLyric 缺少尾部结束时间时，后续空行时间戳作为上一行结束时间。
  - 没有尾部结束时间和空行时间戳时，保留既有 fallback。
- LRC 导出：
  - 普通逐行 LRC 输出空行结束时间。
  - 增强 LRC 输出尾部尖括号结束时间。
  - ESLyric 输出尾部方括号结束时间。
  - 三种 LRC 文件扩展名均为 `.lrc`。

### UI / Composable / Persistence

- `MenuBar`：
  - 导出改为二级菜单。
  - hover 能打开二级菜单，hover 其他项能关闭。
  - 点击每个导出目标 emit 正确 target id。
  - TXT/LRC/SRT/VTT 的损失提示显示正确。
- `ImportConfirmModal`：
  - 普通 LRC 显示普通逐行 LRC。
  - 增强 LRC 显示增强 LRC。
  - ESLyric 显示 ESLyric。
- `useProjectPersistence`：
  - 导出 target 正确映射到 adapter format 和 options。
  - 三种 LRC 导出都调用 `.lrc` 保存文件名。

## 验收要点

- 用户能在导出二级菜单里分别选择普通逐行 LRC、增强 LRC、ESLyric。
- 导入 LRC 文件时，确认框显示更准确的 LRC 子类型。
- 增强 LRC 和 ESLyric 的尾部时间戳不会导入成额外空 word。
- 普通逐行 LRC 导出可用空行时间戳表达上一行结束。
- 三种 LRC 导入时，空行时间戳可作为上一行结束时间；无法承接时被忽略。
- core 层仍不依赖 Vue、Pinia、浏览器文件选择 UI 或 i18n 实例。
