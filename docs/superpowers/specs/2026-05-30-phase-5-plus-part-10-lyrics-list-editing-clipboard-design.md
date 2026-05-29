# Phase 5 Plus Part 10 — 歌词列表编辑与剪贴板粘贴设计

## 目标

让歌词模式在没有音频时也能高效做纯文本歌词编辑：支持从剪贴板粘贴多行歌词，支持在歌词列表中快速插入空行和删除行，并保证所有歌词数据变更都通过 command，可 undo/redo。

## 范围

- `Ctrl+V` 仅在歌词模式下生效。
- 剪贴板文本按纯文本歌词行导入：按换行拆分，trim 后忽略空行，每个非空行使用现有 `autoSplitText()` 转成词块。
- 粘贴前弹出确认框，说明即将插入的位置，并用列表预览即将添加的歌词行内容。
- 粘贴确认后：
  - 当前有选中歌词行：插入到选中行下方。
  - 当前没有选中歌词行：插入到歌词列表底部。
- 歌词列表左侧新增常驻竖向工具栏，类似 Photoshop 置左 ToolBar。
- 工具栏包含四个插入空行按钮：
  - 插入到列表顶部。
  - 插入到当前选中行上方。
  - 插入到当前选中行下方。
  - 插入到列表底部。
- 插入空行后自动选中新行，并直接进入整行编辑模式。
- 每行歌词右侧新增删除按钮；点击后直接删除，不二次确认，依赖 undo 恢复。
- `StatusBar` 报告粘贴成功、粘贴取消、剪贴板不支持、剪贴板读取失败、剪贴板为空、解析后没有可添加歌词等结果。

## 不在范围

- 不实现快捷键自定义 UI；只注册可供 Part 8 使用的新 action。
- 不为插入顶部/底部按钮注册快捷键 action，除非后续需求明确需要。
- 不改变歌词导入文件流程。
- 不改变歌词 timing 数据模型。
- 不在删除行前弹二次确认。
- 不支持粘贴时替换全部歌词。
- 不保留剪贴板文本中的空行。

## Command 设计

新增通用位置感知 command：

- `createInsertLyricLinesAtCommand(insertIndex, lines)`。
- `lines` 中每个 `LyricLine` 必须至少包含一个 word；与现有歌词 command 一样，空 `words` 数组抛错。
- `do()` 执行时把 `insertIndex` clamp 到 `0..state.lyrics.length`，再插入 `lines`。
- `undo()` 使用本次插入的 line id 集合移除这些行。
- command label 使用 `lyrics.insertLinesAt`。

Store 层新增：

- `insertLyricLinesAt(index, lines)`：执行新 command，并通过 `StatusBar` 报告插入行数。
- 现有 `insertLyricLines(lines)` 保留为追加便捷方法，内部可复用 `insertLyricLinesAt(project.lyrics.length, lines)`，避免破坏既有菜单粘贴 modal、导入等入口。

删除行继续复用现有 `createRemoveLyricLineCommand(lineId)` 和 `store.removeLyricLine(lineId)`。

## 剪贴板粘贴流程

新增快捷键 action：

- `lyrics.pasteClipboard`，默认绑定 `Ctrl+V`。
- `useEditorShortcuts` 的文本输入过滤保持不变：当焦点在 textarea、select、contenteditable 或文本类 input 中时，不触发全局粘贴动作。
- `AppShell` 提供给 `useEditorShortcuts` 的有效 bindings 需要按 `editorMode` 过滤：只有 `editorMode === 'lyrics'` 时才包含 `lyrics.pasteClipboard`。这样 timing 模式下不会触发 registry，也不会提前 `preventDefault()` 挡掉浏览器默认粘贴行为。

处理流程：

1. 检查 `navigator.clipboard?.readText` 是否可用；不可用则 `StatusBar` 显示剪贴板不支持。
2. 调用 `readText()`。
3. 读取失败或权限拒绝时显示剪贴板读取失败。
4. 文本 trim 后为空时显示剪贴板为空。
5. 按换行拆分，trim 每行，忽略空行。
6. 如果解析后没有非空行，显示没有可添加歌词。
7. 把待添加行保存为 pending state，打开确认弹窗。
8. 用户确认后，根据当前选中行计算插入位置并执行 `insertLyricLinesAt()`。
9. 用户取消后不修改项目，并显示粘贴取消。

确认弹窗新增 `LyricsClipboardConfirmModal.vue`：

- 展示操作说明：即将把剪贴板文本作为纯文本歌词行插入。
- 展示插入位置：选中行下方或列表底部。
- 用可滚动列表展示将要添加的歌词行文本。
- 提供确认和取消按钮。
- 组件只负责展示和事件，不读取剪贴板、不修改 store。

## 歌词列表 UI

`LyricsLineList.vue` 布局改为：

- 外层横向布局：左侧常驻窄工具栏，右侧为歌词列表。
- 工具栏不跟随每行重复渲染。
- 工具栏按钮使用图标按钮，并提供 tooltip/aria 文案。
- 工具栏按钮：
  - 插入到顶部：始终可用；空列表时插入 index `0`。
  - 插入到当前行上方：需要当前有选中行；无选中时 disabled。
  - 插入到当前行下方：需要当前有选中行；无选中时 disabled。
  - 插入到底部：始终可用；空列表时插入 index `0`。
- 四个按钮触发后都创建一行空歌词，插入成功后选中新行，并调用整行编辑请求。
- 右侧列表保留现有行号、起始时间、歌词词块和词块 timing 状态展示。
- 每行右侧新增删除图标按钮；按钮点击 `stop` 行选择事件，直接删除该行。
- 空列表时右侧展示轻量空态，提示可用左侧工具栏或粘贴导入歌词；主要操作入口仍是工具栏和 `Ctrl+V`。

## Lyrics Editor 行为

`useLyricsEditor` 增加面向 UI 的小动作，避免组件自己拼业务细节：

- `insertEmptyLineAt(index)`：创建空行并调用 store 插入。
- `insertEmptyLineTop()`。
- `insertEmptyLineAboveActive()`。
- `insertEmptyLineBelowActive()`。
- `insertEmptyLineBottom()`。

每个插入动作成功后：

1. `activeLineId` 指向新行。
2. `activeWordIndex` 重置为 `0`。
3. 触发 `requestWholeLineEdit()`。

当前行上方/下方动作在没有 active line 时 no-op，并通过 disabled UI 避免触发。顶部/底部动作在空列表中正常创建第一行。

删除行保持现有行为：删除当前行后选中下一行；如果没有下一行则选中上一行；如果列表为空则清空选择。

## 快捷键与 i18n

新增 `ShortcutAction`：

- `lyrics.pasteClipboard`，默认 `Ctrl+V`。
- `lyrics.insertLineAbove`，默认 `null`。
- `lyrics.insertLineBelow`，默认 `null`。

`lyrics.insertLineAbove` 和 `lyrics.insertLineBelow` 暂不通过默认键位触发，但需要注册到 shortcut registry、默认绑定、设置 UI label map，供后续快捷键自定义使用。

新增 label map：

- command label：`lyrics.insertLinesAt`。
- action label：`lyrics.pasteClipboard`、`lyrics.insertLineAbove`、`lyrics.insertLineBelow`。

新增状态文案：

- 粘贴成功，带行数。
- 粘贴取消。
- 剪贴板 API 不支持。
- 剪贴板读取失败或权限拒绝。
- 剪贴板为空。
- 剪贴板中没有可添加的歌词行。
- 插入空歌词行成功。

## 错误处理

- 剪贴板相关失败只通过 `StatusBar` 提示，不抛到全局。
- 弹窗确认前不修改项目数据。
- 解析失败、空数据、取消操作都不产生 undo 历史。
- command 执行成功后才标记 dirty。
- 删除行不弹确认，但保留 undo/redo。

## 测试计划

Core command tests：

- 按指定 index 插入多行。
- 负数 index 插入到顶部。
- 超出长度 index 插入到底部。
- undo 移除本次插入的行。
- `words.length === 0` 时抛错。

Store tests：

- `insertLyricLinesAt()` 执行 command、标记 dirty、显示插入状态。
- `insertLyricLines()` 保持追加语义。
- 删除行仍可 undo。

Composable/component tests：

- 空列表时顶部/底部按钮可创建第一行并进入整行编辑。
- 无选中行时当前行上方/下方按钮 disabled。
- 有选中行时四个插入按钮计算正确位置。
- 插入空行后新行被选中，并触发整行编辑。
- 行右侧删除按钮删除对应行，且不触发行选择。

Shortcut/AppShell tests：

- 歌词模式下 `Ctrl+V` 读取剪贴板并打开确认弹窗。
- timing 模式下 `Ctrl+V` 不执行歌词粘贴，也不调用 `preventDefault()`。
- 文本输入焦点内 `Ctrl+V` 不触发全局粘贴。
- 粘贴确认后插入到选中行下方。
- 无选中行时粘贴确认后插入到底部。
- 剪贴板不支持、读取失败、空文本、无非空行时显示对应 `StatusBar` 状态且不修改项目。

## 验收标准

- 未导入音频时，歌词模式仍可插入空行、删除行、粘贴歌词。
- 插入歌词行、删除歌词行和粘贴插入都可 undo/redo。
- `Ctrl+V` 只在歌词模式和非文本输入焦点下作为歌词粘贴生效。
- 粘贴前必须弹出确认框，并列表预览将添加的歌词行。
- 空行被忽略，不创建空白歌词行。
- 工具栏四个插入按钮行为稳定，空列表也能创建第一行。
- 插入空行后直接进入整行编辑模式。
- 剪贴板权限或数据错误都通过 `StatusBar` 提示。
