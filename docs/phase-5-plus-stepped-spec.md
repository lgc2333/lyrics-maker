# Phase 5 Plus 分步规格

本文档将 `docs/phase-5-plus-spec.md` 重新整理为多个可独立计划、独立实现、独立验证的 Part。
每个 Part 在实现前都应该单独写 implementation plan，并按项目规则使用 TDD。后面的 Part 可以依赖前面 Part 建好的基础能力。

## 已确认的产品决策

- 无音频状态采用方案 A：即使还没有导入音频，用户也可以进入歌词模式。
- 需要音频的操作不能静默忽略。操作无法执行时，应保持界面稳定，并在 `StatusBar` 中显示明确提示。
- `StatusBar` 放入 Part 1。后续保存、导入导出、快捷键冲突、边界状态提示都复用同一条反馈通道。
- Part 1 以 `StatusBar` 接入和无音频边界为主。由于它会触碰较多现有操作入口，其他简单 UI 修正也应尽量后移；只有 `LineOverlay` 分词虚线改色保留在 Part 1。

## Part 1：StatusBar 地基与无音频边界

### 目标

先建立全局状态提示通道，并让无音频模式的行为变得可预期。这个 Part 的重点不是堆 UI 小修，而是把当前项目已有的重要操作统一接到 `StatusBar`，为后续保存、导入导出、快捷键和设置打基础。

### 范围

- 新增底部 `StatusBar`。
  - 左侧显示临时提示和持久状态。
  - store、composable、component 都应该能使用它，但 `core/` 逻辑不能依赖 Vue UI。
  - 第一版要覆盖当前项目已有的重要操作提示，而不仅是不支持的操作。
- `StatusBar` 第一版建议覆盖这些操作：
  - 项目/历史状态：
    - 有未保存更改。
    - 对当前已有保存入口/快捷键的结果给出提示：保存成功、保存失败、取消保存。
    - 撤销成功，并显示撤销的操作名称。
    - 重做成功，并显示重做的操作名称。
    - 没有可撤销/重做操作时显示提示。
  - 音频与播放：
    - 导入音乐成功。
    - 音频加载失败。
    - 无音频时点击播放/暂停、拖动进度条、跳转小节/拍线时显示提示。
    - 播放、暂停、seek 可以按需要显示短提示，但不要刷屏。
  - Timing 与节拍：
    - 新增、更新、删除 TimingPoint。
    - Tap BPM 因无音频无法执行。
    - Tap BPM 得到有效 BPM 后显示结果。
    - 节拍器开启、关闭、进入 latch 状态。
  - 歌词编辑与打轴：
    - 导入/粘贴歌词成功。
    - 新增、删除、编辑歌词行或词块。
    - 无音频时触发依赖音频时间的歌词打轴快捷键。
    - 设置行起始时间、设置词结束时间、清除词结束时间。
  - 设置类操作：
    - 吸附开关变化。
    - 节奏模式和细分倍数变化。
    - 音乐/SFX 音量变化。
- 未导入音频时，允许切换到歌词模式。
- 未导入音频时，允许切换波形/频谱视图。
- 需要音频的操作要被拦截，并通过 `StatusBar` 提示，不能静默忽略。
  - 无音频时点击播放/暂停。
  - 无音频时拖动或点击播放进度。
  - 无音频时触发依赖 `currentTime` 的歌词打轴快捷键。
  - 无音频时 Tap BPM。
  - 无音频时播放当前行/当前词区间。
- 未导入音频时，保留现有纯文本歌词编辑能力。
- 将 `LineOverlay` 的分词虚线改为黄色，提高可读性。
- 本地化以下 Timing 控件文本：
  - `Offset`
  - `Set offset to current time`
  - `Tap to get BPM`

### 建议涉及文件

- `src/components/shell/AppShell.vue`
- `src/components/shell/StatusBar.vue`（新增）
- `src/components/shell/TransportBar.vue`
- `src/composables/useLyricsEditor.ts`
- `src/composables/useEditorShortcuts.ts`
- `src/stores/editor-store.ts`
- `src/i18n/locales/zh-CN.json`
- `src/platform/waveform/line-overlay-plugin.ts`
- `src/i18n/locales/zh-CN.json`

### 验收要点

- 无音频时，所有需要音频的操作都会在 `StatusBar` 中提示。
- 无音频时，歌词模式可用于文本编辑。
- 无音频时，打轴类操作不会修改 timing 数据。
- 当前已有的重要操作能通过 `StatusBar` 给出清晰反馈。
- `LineOverlay` 分词虚线变成黄色。
- Part 1 不实现完整项目保存、首选项、导入导出，也不做大范围菜单/控件重设计。
- 完整保存、另存为、打开工程、自动保存和草稿恢复仍放在 Part 5；Part 1 只接入当前已有保存入口的状态提示。

## Part 2：Timing 与菜单 UI 整理

### 目标

在 `StatusBar` 通道存在之后，整理菜单、Timing 控件和 `WordSplitBar` 的打轴 UI。

### 范围

- 修复歌词打轴时 Enter 进入下一句后的行为：当前词位置永远回到起始块。
- 让编辑菜单中的 Undo/Redo 可用，并显示当前操作名称。
- 启用吸附按钮，并连接到 `ProjectSettings.snapEnabled`。
- 将 TimingPoint 列表的删除按钮改为图标。
- 重新组织菜单项，但不在本 Part 实现后续功能本体：
  - 文件：新建工程、打开工程、打开音乐、保存项目、项目另存为、首选项
  - 编辑：撤销、重做
  - 帮助：关于
- 当某个顶级菜单已打开时，hover 其他顶级菜单应自动切换展开项。未来如果加入二级菜单，也应支持 hover 展开。
- 将节奏模式下拉框改成三态按钮：
  - 普通
  - 三连音
  - Alt 临时三连音指示
- 将细分倍数下拉框改成“左减 / 中间数值 / 右加”的控件。
- 调整 `WordSplitBar` 打轴模式布局：保持单行，把时间输入放到最右侧。
  - 起始块：时间戳输入框，按 Enter 应用。
  - 其他词块：显示 `xx:xx.xxx ~` 加时间戳输入框，按 Enter 应用。

### 建议涉及文件

- `src/components/shell/MenuBar.vue`
- `src/components/shell/TransportBar.vue`
- `src/components/shell/TimingPointList.vue`
- `src/components/shell/TimingPointControls.vue`
- `src/components/shell/WordSplitBar.vue`
- `src/composables/useLyricsEditor.ts`
- `src/stores/editor-store.ts`
- `src/core/commands/history.ts`

### 验收要点

- Undo/Redo 菜单项能正确反映可用状态和操作名称。
- 吸附按钮可切换，并影响已有打轴逻辑。
- 菜单项如果对应功能安排在后续 Part，可以先保持禁用状态。
- Timing 控件 UI 调整不改变 timing 数学逻辑。
- `WordSplitBar` 中的 timing 编辑仍然通过 command 修改数据。

### 后更改/修复

- 普通/三连音/三连音Alt的切换应为图标按钮状，类似波形/频谱切换，在处于Alt态是更改颜色，且屏蔽任何操作
- Enter键打轴的逻辑修复完毕，但是D键的逻辑依旧有问题，在起始处按D后，直接跳到了第一个未打轴的词，不应该是这样，应该固定跳到当前词的下一个词（index +1）
- 词块时间调整的UI理解错了，应该是当敲选中的词块在切词栏的最右边显示时间输入框
- 普通/三连音/三连音Alt的切换是单个按钮，不是按钮组，做成和频谱/波形切换一样的样式，另外alt状态下做成黄色
- 词块时间修改的输入框要做成以格式化时间形式输入，而不是秒数（操作类似Adobe Pr，失焦或回车应用）
- 在http协议下访问时，Uncaught TypeError: crypto.randomUUID is not a function
- 频谱垂直缩放和VolumePopover是同种组件，应该重命名VolumePopover，然后把这个也接入组件，也出现了patterns写过的鼠标够不到的问题
- 界面里一些元素焦点不应该阻拦快捷键，比如歌曲进度条，请将快捷键拦截判定收紧
- MenuBar的Popup是定死宽度的，不要定死，改成min w，撤销重做的文本太长被wrap了

## Part 3：时间线滚动、seek 跟随与缩放行为

### 目标

让 `MainView` 的滚动跟随更符合用户预期：播放时不过早居中，显式跳转时能准确跟到目标位置。

### 范围

- 播放时，如果播放指针还在目标居中阈值左侧，不要自动居中；等指针到达阈值后再继续自动跟随。
- 拖动播放进度条时，`MainView` 应滚动到目标时间附近。
- 点击歌词行触发 seek 后，`MainView` 应滚动到对应时间位置。
- 频谱缩放应以鼠标位置为中心。
- 在 `TransportBar` 添加一个开关，用于关闭播放时的 `MainView` 自动居中。

### 建议涉及文件

- `src/platform/waveform/wavesurfer-view.ts`
- `src/composables/useTimelineView.ts`
- `src/components/shell/TransportBar.vue`
- `src/components/shell/MainView.vue`
- `src/composables/useLyricsEditor.ts`

### 验收要点

- 程序触发的 seek 和进度条 seek 都会更新滚动位置。
- 用户手动滚动后的冷却逻辑仍然有效，不会马上被自动跟随抢回。
- 自动居中开关只影响播放过程中的跟随，不影响显式 seek。

### 后更改/修复

- MainView滚动的时候，播放进度并没有居到窗口最中心
- 在音乐刚开始播放的一段时间，即使MainView在别的地方，也不会把视图拉回去
- 现在的行为是在任意地方下，播放头没超过中点则不跟随滚动吗？不是的话改成这样吧，但是得考虑在屏幕外的情况，在屏幕外必须回中
- 点击波形修改歌曲进度时，自动回中了，取消自动回中也会出问题。要不将seek的阈值改为左右10%，如果超出则根据位置滚动到两侧的10%位置，seek自动滚动行为不受自动归中这个是对的
- 当当前timeline中没有timing point时，网格渲染直接罢工，也不会清空已有网格线

## Part 3.5：Timeline overlay 坐标系与播放性能整理

### 起因

播放时自动归中的跟随滚动在高刷新率屏幕上看起来只有低帧率，并且在居中放大时播放指针有抖动。调研 WaveSurfer 的 Regions、Envelope 等插件后，倾向于让时间线装饰层进入 WaveSurfer wrapper 坐标系，而不是继续用外层固定 canvas 每帧重算和重绘。

### 目标

把时间线 overlay 从外层固定 canvas 改成跟随 WaveSurfer wrapper 滚动的内容层，同时把播放指针拆成独立的轻量 overlay，避免播放时每帧重绘网格和歌词。

### 后修复

第一轮 wrapper-attached overlay 重构解决了坐标系统一和播放热路径拆分，但随后暴露出新的性能瓶颈：播放跟随会持续写入 `scrollLeft`，并触发 WaveSurfer 的 `scroll` 事件；当 grid/lyrics overlay 在每次 scroll 上都 `replaceChildren()` 并重建可见范围内的 SVG/DOM 节点时，DevTools 可以看到大量元素属性疯狂变化，页面会明显卡顿。低 zoom 下固定 `0.5s` buffer 太小，容易频繁越界重绘；细 subdivision 线密度过高时也会生成过多 SVG line。播放指针抖动则来自整数像素取整和跟随滚动后的更新顺序。

### 已完成内容

- `WaveSurferView` 增加 wrapper、scroll container、duration、pixels-per-second 和 visible range 等几何 helper。
- 播放自动跟随改为平滑追赶：
  - 低 zoom 下超过阈值后每次最多追 10px。
  - 高 zoom 下使用完整追赶距离。
  - 指针在可视区域外时仍然直接拉回到视图中间。
- 新增独立 `PlayheadOverlayPlugin`：
  - playhead 是外层容器上的单条 DOM 线。
  - 只根据 `currentTime`、`scrollLeft` 和 pixels-per-second 更新 `transform`。
  - 不依赖 timing points，删除最后一个 timing point 不会隐藏播放指针。
- `GridOverlayPlugin` 改成挂载在 `wavesurfer.getWrapper()` 内的 SVG layer：
  - 使用 WaveSurfer wrapper 坐标系。
  - 只渲染当前可见范围加动态 buffer 内的 beat/bar/subdivision 线。
  - 记录已渲染范围；只要新的可见范围仍被覆盖，scroll 时跳过 DOM 重建。
  - buffer 随当前可见时长放大，至少为半个可见时长，避免低 zoom 下频繁越界。
  - 低 zoom 下对过密 subdivision 线做 decimation，跳过像素距离太近的细分线。
  - 不再负责绘制 playhead。
  - `currentTime` 不再进入 grid overlay 的更新参数。
- `LineOverlayPlugin` 改成挂载在 `wavesurfer.getWrapper()` 内的 DOM layer：
  - 使用 WaveSurfer wrapper 坐标系。
  - 只渲染当前可见范围加动态 buffer 内的已完成歌词区间。
  - 记录已渲染范围；scroll 仍落在 buffer 内时不重建歌词 DOM。
  - 保留红色行起点、蓝色行终点、黄色分词虚线、区间填充和 trimmed word label。
  - `currentTime` 不再进入 lyrics overlay 的更新参数。
- `useTimelineView` 拆分 overlay 更新热路径：
  - `currentTime` tick 只更新 playhead 和播放跟随。
  - timing point、细分、triplet 改变才更新 grid。
  - lyrics 数据改变才更新 lyrics overlay。
  - ready、scroll、zoom、redraw、resize 会刷新 playhead 位置。
  - 播放跟随写完 `scrollLeft` 后会再次刷新 playhead，避免指针使用旧 scroll offset。
- `PlayheadOverlayPlugin` 保留 subpixel `translateX`，不再把坐标取整到整数像素，减轻居中放大时的视觉抖动。
- 更新 `docs/patterns/timeline-audio-lyrics.md`，记录 wrapper-attached overlay、虚拟化、rendered range cache、动态 buffer、低 zoom decimation 和 playhead 独立规则。

### 验收结果

- 目标测试覆盖：
  - `wavesurfer-view.spec.ts`
  - `playhead-overlay-plugin.spec.ts`
  - `grid-overlay-plugin.spec.ts`
  - `line-overlay-plugin.spec.ts`
  - `useTimelineView.spec.ts`
- 验证记录：
  - 首轮 targeted tests：64 passed
  - 首轮 full tests：663 passed
  - 后续性能修复 targeted tests：71 passed
  - `pnpm lint`
  - `pnpm format`
  - `pnpm check`

## Part 4：Overlay 部分打轴显示与指针预览

### 目标

改进时间线 overlay，让未完全打轴的歌词行也能显示，并增加网格上的鼠标时间预览。

### 范围

- 只要歌词行有 `startTime`，即使整句还没完全打轴，也应该显示在 `LineOverlay` 上。
- 每行按显示顺序遍历词。
  - 遇到缺少 `endTime` 的词时，忽略并跳过该词的渲染，而不是停止整行渲染。
  - 继续遍历到下一个拥有 `endTime` 的词块时，背景和可见 timed segment 从上一个有效边界延伸到这个词块的 `endTime`。
  - 如果最后一个词块拥有 `endTime`，即使句子中间仍有跳过的未完成词，也绘制最终句尾颜色线。
  - 如果最后一个词块没有 `endTime`，最后一个可见边界只显示为分词虚线。
- 在 `GridOverlay` 上添加当前鼠标指针位置的时间预览。

### 建议涉及文件

- `src/platform/waveform/line-overlay-plugin.ts`
- `src/platform/waveform/grid-overlay-plugin.ts`
- `src/composables/useTimelineView.ts`
- `src/components/shell/MainView.vue`

### 验收要点

- 已完全打轴的行保持原有起点、终点边界和填充行为。
- 部分打轴的行从行起点显示到最后一个已设置 `endTime` 的词；中间缺少 `endTime` 的词会被跳过，后续 timed segment 会从上一个有效边界继续延伸。
- 没有 `startTime` 的未打轴行仍然不显示在 `LineOverlay` 上。

### 后修复/需求

- 鼠标滚轮缩放时时间预览还在原处没有更新
- 鼠标在右侧无法展示完整时间时，时间应调整到左侧
- 给起始、结束线上下加一个小直角三角，给播放进度线上下加三角

## Part 5：项目保存、自动保存、草稿恢复与标题编辑

### 目标

在 `StatusBar` 基础上建立完整的项目持久化和项目身份管理流程。

### 范围

- 通过菜单和 `Ctrl+S` 保存项目。
- 通过菜单“另存为”。
- 通过菜单打开项目。
- 每分钟自动保存；只有已经拿到文件句柄时才触发成功写盘。
- 实时保存项目草稿到浏览器本地存储。
- 应用启动时，如果存在浏览器草稿，则读取草稿。
- 从浏览器草稿恢复后，项目应标记为未保存。
- 标题栏显示 `*工程名` 表示 dirty 状态。
- 点击标题栏标题后，变成内联编辑框，可修改工程名。
- `StatusBar` 报告保存成功、自动保存成功/失败、草稿恢复、持久化错误。

### 建议涉及文件

- `src/platform/persistence/file-system-access.ts`
- `src/platform/persistence/project-file-service.ts`
- `src/composables/useProjectPersistence.ts`
- `src/stores/editor-store.ts`
- `src/core/commands/project-commands.ts`
- `src/components/shell/MenuBar.vue`
- `src/components/shell/AppShell.vue`
- `src/components/shell/StatusBar.vue`

### 验收要点

- 浏览器不支持 File System Access API 时，应通过 `StatusBar` 友好降级。
- 自动保存不会打开文件选择器。
- 从浏览器草稿恢复的项目不能被标记为 clean。

### 后修复/需求

- 重打轴流程下，因受到已设置的词块endTime影响，网格吸附失效
- 从其他行选中某行歌词时，处于打轴模式的切词栏无论如何永远选中第一个，但是如果再重复触发选中同一行歌词，保持用户当前选择的词块
- 在切词栏点击选中某词块时，seek到对应词块位置
- 播放当前句子与播放当前词快捷键按下时未在正确地方停止播放，注意做这个功能时要考虑可能的边界情况
- 切换频谱图后，节奏网格、当前播放进度、歌词区域不是层级错误，而是对比度不足；移到 Part 5.5 统一处理可读性

## Part 5.5：打开工程脏状态确认与 Timeline Overlay 可读性修复

### 目标

补齐打开其他工程前的未保存确认流程，并改善 Timeline Overlay 在亮色模式、频谱视图、以及非暗色波形场景下的可读性。当前 overlay 层级是正确的，本 Part 不做层级重构，重点是让已有元素在不同背景上更清楚。

### 范围

- 打开工程前，如果当前项目处于 dirty 状态，必须先弹出确认对话框。
- 确认对话框提供三个选择：
  - 保存并打开其他项目。
  - 不保存并打开其他项目。
  - 取消操作。
- “保存并打开其他项目”应先执行当前项目保存流程：
  - 保存成功后继续打开工程。
  - 保存失败或用户取消保存时，不打开新工程，并通过 `StatusBar` 显示结果。
- “不保存并打开其他项目”直接进入打开工程流程。
- “取消操作”关闭对话框并保持当前项目不变。
- 如果当前项目不是 dirty 状态，打开工程应直接进入现有打开流程，不弹确认。
- `StatusBar` 报告打开工程取消、保存失败、打开失败、打开成功等结果。
- 改善 Timeline Overlay 的可见度：
  - 亮色模式下，歌词区间、词块文字、边界线、分词线、播放头、节奏网格线都应有足够对比度。
  - 频谱视图下，歌词区间、词块文字、边界线、分词线、播放头、节奏网格线都应在高饱和频谱背景上清楚可见。
  - 暗色波形模式下当前词块文字可读性基本可接受，应避免明显破坏现有观感。
  - 非暗色波形场景下，词块文字需要增强对比度。
  - 三角标记当前形状和显示位置清楚，本 Part 只增强其颜色、描边、阴影等对比度，不改变几何结构。
- 节奏网格线是否增强以实际检查为准；如果在亮色模式或频谱视图下对比度不足，应一并调整。
- 本 Part 采用按 `theme + viewMode` 区分的 overlay 样式 token，统一供歌词文字、歌词区间、边界线、分词线、播放头和网格线使用。
- 本 Part 不改变 overlay 坐标系、虚拟化策略、播放跟随逻辑、频谱渲染逻辑或歌词 timing 数据模型。

### 建议涉及文件

- `src/components/shell/AppShell.vue`
- `src/components/shell/MenuBar.vue`
- `src/components/shell/UnsavedChangesDialog.vue`（新增，或复用现有 modal 模式）
- `src/composables/useProjectPersistence.ts`
- `src/stores/editor-store.ts`
- `src/platform/waveform/line-overlay-plugin.ts`
- `src/platform/waveform/grid-overlay-plugin.ts`
- `src/platform/waveform/playhead-overlay-plugin.ts`
- `src/i18n/locales/zh-CN.json`

### 验收要点

- dirty 项目打开其他工程前一定会出现三选一确认。
- 保存并打开时，只有保存成功才继续打开新工程。
- 保存失败、保存取消、打开取消都不会丢失当前项目。
- 不保存并打开会明确丢弃当前未保存更改，并载入用户选择的工程。
- 非 dirty 项目打开工程时不出现额外确认。
- 亮色模式和频谱视图下，歌词文字、歌词区间、边界线、三角标记、播放头和网格线都能清楚辨认。
- 暗色波形模式不因本次调整出现过重、刺眼或遮挡波形的问题。
- 本 Part 不处理完整快捷键自定义、本地设置导入导出、导入导出插件和 overlay 拖拽编辑。

### 简短实现 Plan

1. 先补测试：覆盖 dirty 打开工程三选一流程，特别是保存成功继续、保存失败中止、不保存继续、取消中止。
2. 实现打开工程 guard：菜单“打开工程”先检查 dirty，必要时弹确认，再分支调用保存/打开。
3. 补 i18n 和 `StatusBar` 文案，确保保存失败、保存取消、打开取消、打开成功和打开失败都有反馈。
4. 为 timeline overlay 增加按主题和视图模式切换的样式 token，优先覆盖文字、区间填充、边界线、三角标记、播放头和网格线。
5. 补 overlay 样式测试，检查亮色模式和频谱视图下的关键 class/style/token 被应用。
6. 验证相关测试后，再跑 `pnpm lint`、`pnpm format`、`pnpm check`。

## Part 6：本地用户设置与首选项地基

### 目标

把浏览器本地用户偏好和项目数据分离。

### 范围

- 将这些用户偏好持久化移动到 `LocalStorage`，不再作为项目数据保存：
  - 亮色/暗色模式。
  - 音乐音量和 SFX 音量。
  - 波形/频谱视图状态。
  - 频谱垂直缩放，默认值调整为 500%。
  - 播放时自动跟随按钮状态。
  - 节拍器开启状态。
  - 吸附开启状态。
  - 细分倍数。
- 从项目模型和旧项目文件兼容读取流程中移除这些旧设置字段：
  - `audio.musicVolume`
  - `audio.sfxVolume`
  - 节拍器状态字段。
  - 吸附状态字段。
  - 细分倍数字段。
- 音乐和 SFX 音量按钮支持点击静音/解除静音。
- 支持浏览器本地设置导入/导出。
- 增加“首选项”的入口和 modal/screen 地基。
- 使用 `StatusBar` 报告设置导入/导出的成功和错误。

### 建议涉及文件

- `src/platform/settings/*`（新增）
- `src/composables/useLocalSettings.ts`（新增）
- `src/components/shell/VolumePopover.vue`
- `src/components/shell/TransportBar.vue`
- `src/components/shell/MainView.vue`
- `src/components/shell/MenuBar.vue`
- `src/components/shell/AppShell.vue`
- `src/components/shell/StatusBar.vue`
- `src/stores/editor-store.ts`
- `src/core/domain/project.ts`

### 验收要点

- 修改本地用户偏好不会让项目变 dirty。
- 完成本 Part 后，本地用户偏好变化不应进入 undo/redo 历史。
- 新建项目和打开旧项目后，音乐音量、SFX 音量、亮暗模式、波形/频谱状态、频谱缩放、自动跟随、节拍器、吸附和细分倍数都来自浏览器本地设置。
- 没有本地设置时，频谱垂直缩放默认值为 500%。
- 保存项目时，不再写入音乐音量、SFX 音量、节拍器状态、吸附状态和细分倍数字段。
- 导入本地设置前必须校验数据结构。

## Part 7：导入导出架构与文件交互

### 目标

建立可扩展的 TXT/LRC/ASS 导入导出能力，并提供友好的文件交互流程。

### 范围

- 新增 TXT、LRC、ASS 的导入/导出插件架构。
- TXT 导入生成无 timing 的歌词行。
- LRC/ASS 导入尽量把 timing 数据映射到项目模型。
- 导出使用同一套可扩展架构，方便后续增加格式。
- 用户拖入支持的文件时，先弹出确认 modal，再执行导入。
- 导入确认框说明识别到的文件类型和将要执行的操作。
- `StatusBar` 报告导入/导出结果。

### 建议涉及文件

- `src/core/import-export/*`（新增）
- `src/platform/persistence/*`
- `src/components/shell/ImportConfirmModal.vue`（新增）
- `src/components/shell/MenuBar.vue`
- `src/components/shell/AppShell.vue`
- `src/components/shell/StatusBar.vue`
- `src/stores/editor-store.ts`

### 验收要点

- parser/exporter 代码必须保持 Vue-free。
- UI 确认流程负责浏览器文件交互和用户选择。
- 不支持的文件类型通过 `StatusBar` 提示并拒绝导入。

## Part 8：快捷键自定义

### 目标

允许用户自定义快捷键，并把快捷键绑定保存到浏览器本地。

### 范围

- 快捷键 registry 支持替换已有绑定。
- 冲突检测保持明确且可测试。
- 用户自定义快捷键保存到 `LocalStorage`。
- 首选项 UI 支持查看和编辑快捷键。
- 歌词打轴 mark 动作支持副键位，例如 `S`。
- `StatusBar` 报告快捷键冲突和修改成功。

### 建议涉及文件

- `src/platform/shortcuts/registry.ts`
- `src/platform/shortcuts/keystroke.ts`
- `src/composables/useEditorShortcuts.ts`
- `src/platform/settings/*`
- `src/components/shell/PreferencesModal.vue`
- `src/components/shell/StatusBar.vue`

### 验收要点

- 重置首选项后，默认快捷键仍然可用。
- 输入框、文本域、下拉框中仍然不触发全局快捷键。
- `normalizeKeystroke()` 对 IME 组合输入的保护仍然保留。

## Part 9：音频播放增强

### 目标

增加播放速度控制，并完成音量交互的细节 polish。

### 范围

- 增加歌曲播放速度选项：
  - 25%
  - 50%
  - 75%
  - 100%
- 播放速度控制放在音乐音量按钮左侧。
- 音乐和 SFX 音量按钮支持点击静音/解除静音。
- 如有必要，`StatusBar` 可以提示播放速度变化。

### 建议涉及文件

- `src/platform/audio/audio-transport.ts`
- `src/stores/editor-store.ts`
- `src/components/shell/TransportBar.vue`
- `src/components/shell/VolumePopover.vue`

### 验收要点

- 播放速度只影响音频播放，不改变项目 timing 数据。
- 静音时保留上一次非零音量，解除静音后恢复。

## Part 10：歌词列表编辑与剪贴板粘贴

### 目标

让歌词模式在没有音频时也能高效进行文本编辑。

### 范围

- 歌词模式下支持 `Ctrl+V` 从剪贴板导入歌词文本。
- 歌词行右侧增加图标操作：
  - 删除歌词行。
  - 在上方添加空行。
  - 在下方添加空行。
  - 重新排序歌词行。
- 所有可编辑歌词变更都必须通过 command 对象。
- `StatusBar` 报告粘贴/导入成功，以及剪贴板操作被拒绝或失败。

### 建议涉及文件

- `src/core/commands/lyrics-commands.ts`
- `src/stores/editor-store.ts`
- `src/composables/useLyricsEditor.ts`
- `src/composables/useEditorShortcuts.ts`
- `src/components/shell/LyricsLineList.vue`
- `src/components/shell/StatusBar.vue`

### 验收要点

- 本 Part 应在未导入音频时也可使用。
- 重排和插入歌词行必须可 undo。
- 剪贴板权限或数据错误通过 `StatusBar` 提示。

## Part 11：Overlay 拖拽编辑

### 目标

允许用户直接在 `LineOverlay` 上拖动歌词 timing。

### 范围

- 可拖动每行歌词的起始点/结束点。
- 可拖动每个词的起始/结束边界。
- 拖拽结果转换为现有 command 驱动的 timing 变更。
- 拖拽目标按项目吸附设置进行 snap。
- 无效拖拽和成功 timing 更新视情况通过 `StatusBar` 提示。

### 建议涉及文件

- `src/platform/waveform/line-overlay-plugin.ts`
- `src/composables/useTimelineView.ts`
- `src/stores/editor-store.ts`
- `src/core/commands/lyrics-commands.ts`
- `src/components/shell/MainView.vue`
- `src/components/shell/StatusBar.vue`

### 验收要点

- platform overlay 代码不能直接修改项目数据。
- platform overlay 只发出意图数据，由 Vue/store 层应用 command。
- 现有键盘打轴流程必须继续可用。

## 推荐实施顺序

1. Part 1：StatusBar 地基与无音频边界。
2. Part 2：Timing 与菜单 UI 整理。
3. Part 3：时间线滚动、seek 跟随与缩放行为。
4. Part 3.5：Timeline overlay 坐标系与播放性能整理。
5. Part 4：Overlay 部分打轴显示与指针预览。
6. Part 5：项目保存、自动保存、草稿恢复与标题编辑。
7. Part 5.5：打开工程脏状态确认与 Timeline Overlay 可读性修复。
8. Part 6：本地用户设置与首选项地基。
9. Part 7：导入导出架构与文件交互。
10. Part 8：快捷键自定义。
11. Part 9：音频播放增强。
12. Part 10：歌词列表编辑与剪贴板粘贴。
13. Part 11：Overlay 拖拽编辑。

## 后续计划说明

- 每个 Part 在改代码前都应先写独立 implementation plan。
- 每个 Part 都使用 TDD。
- `core/` 和 `platform/` 必须保持 Vue-free。
- 所有会修改项目数据的 UI 操作都必须走 command。
- `StatusBar` 应被视为共享基础设施，不要把提示文字散落在各个控件内部。
