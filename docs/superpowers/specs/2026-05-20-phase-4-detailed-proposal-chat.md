下面是按聊天记录顺序整理的对话内容，保留了原文及 Agent 的操作信息。

---

**用户**:  
我刚刚确定了一部分歌词模式的操作逻辑，准备实现了，还有什么浅层UI或者深层架构要问的吗

**Agent**:

- 读取了 `2026-05-16-lyrics-maker-phased-design.md`
- 读取了 `2026-05-20-phase-4-ui-proposal.txt`

读完了设计记录。对话结束在架构方案展示、等你确认布局那里。在实现前，还有几个关键点没明确：

**架构级（影响 Command 设计）：**

1. **D 键语义**：每次按 D 是标记"当前词的终点"（同时推进到下一词），还是分两次（第一D=startTime, 第二D=endTime）？Aegisub 是前者
2. **Undo 粒度**：每次 D 是一个独立 Command，还是整句打完才入栈？

**UI 级：**  
3. **WordSplitBar 可见性**：始终在歌词模式下展开，还是只在选中某一句时才展开？  
4. **打轴起点**：用户怎么"进入"某句的打轴状态——点选行 + 按 Space 开始播放？还是播放到该句自动激活？  
5. **重打轴行为**：已有时间的句子，重新走一遍 D 流程，是从第一词重头覆盖，还是从当前播放位置继续？

---

**用户**:  
/using-superpowers 使用这个skill，重新走流程问我

**Agent**:

- 创建 0 个待办事项
- 调用 skill: using-superpowers
- 调用 skill: brainstorming
- 读取 `LyricsPanel.vue`
- 读取 `editor-store.ts`
- 读取 `project.ts`
- 读取 `AppShell.vue`
- 读取 `project-commands.ts`

上下文已充分了解。从头走流程——先单独做视觉伴侣询问。

Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams, comparisons, and other visuals as we go. This feature is still new and can be token-intensive. Want to try it? (Requires opening a local URL)

---

**用户**:  
可以

**Agent**:

- 创建 0 个待办事项
- 读取 `visual-companion.md`
- 尝试启动视觉伴侣服务器，首次失败（node 未找到）
- 查找 node 可执行文件
- 通过 `fnm exec` 重新启动服务器，成功：`http://localhost:62307`

服务器已启动：**http://localhost:62307**

现在开始问第一个问题——这是纯概念题，用文字回答就够了。

**D 键的语义是什么？**

按 D 时，到底发生了什么：

- **A）标记当前词的终点，同时推进到下一词** — 第一次 D = 第一个词的 endTime，同时 startTime 自动等于上一词的 endTime（或句子起点）。每词只需按一次。这是 Aegisub 的做法
- **B）两次按键标记一词** — 第一次 D = 当前词的 startTime，第二次 D = endTime，再跳下一词。每词需要按两次，但能精确控制起点
- **C）标记当前词的起点，推进到下一词（endTime 自动等于下一词 startTime）** — 每词一次按键，但起点而非终点

---

**用户**:  
A

**Agent**:  
（无回复，等待二次输入）

---

**用户**:  
A

**Agent**:  
确认：**每次 D 独立入栈**，细粒度撤销。

---

下一个问题：**WordSplitBar（切词面板）的可见性**

切词面板什么时候展示：

- **A）歌词模式下始终展开** — 只要切换到歌词模式，切词面板就一直可见，不管当前有没有选中哪一句
- **B）选中某一句时才展开** — 点击歌词列表中的某行，底部切词面板才展开并显示该句的词块
- **C）单独一个切词阶段** — 整体打轴流程分两个阶段：先进入切词模式（对所有句切词），完成后进入打轴模式。面板随阶段切换

---

**用户**:  
A

**Agent**:  
确认：**歌词模式下切词面板始终展开**。

---

下一个问题：**怎么"进入"某句的打轴状态？**

用户选好了一句准备打轴，流程是：

- **A）点选行 + Space 开始播放** — 在歌词列表点击某行高亮它，然后按 Space 开始播放，D 键就对这句生效
- **B）播放到该句位置自动激活** — 播放头经过哪句的时间范围，那句就自动成为"当前句"，D 键对它生效
- **C）点选行后自动 seek 到该句起点，再按 Space 播放** — 点击行 = seek + 激活，用户只需再按 Space

---

**用户**:  
C，注意处理该行没有起始时间的情况，为我推荐方案

**Agent**:  
确认 C，关于无起始时间的处理，我的推荐方案：

**优先级降级 seek：**

1. 该行有时间 → seek 到第一个词的 startTime（或行起点）
2. 该行无时间，但上一行有时间 → seek 到上一行最后一个词的 endTime（自然衔接，用户从那里开始打）
3. 上一行也无时间 → **不 seek，保持当前播放头位置**，仅激活该行

这样用户从上往下顺序打轴时，体验最流畅——点击下一句自动跳到上一句结束处；跳着选则不强制移动播放头。  
你觉得这个降级逻辑 OK 吗？

---

**用户**:  
该行在选中状态且没有起始时间时，按D键则将当前播放时间赋予它（注意按键也会自动吸附到网格），按Enter则将该行结束时间赋予它并进入下一行

**Agent**:  
明白了，所以完整的 D/Enter 语义是：

- **无时间的行**：D = 设置 startTime（吸附），Enter = 设置 endTime + 进下一行
- **有时间的行（逐词打轴中）**：D = 标记当前词 endTime + 推进，Enter = 标记行 endTime + 进下一行

seek 降级逻辑我按之前的方案处理（上一行 endTime → 保持播放头）。

---

下一个问题：**切词面板的交互方式**（视觉题，我来做个 demo）

切词面板显示一行歌词的字符，用户需要在字符之间插入/删除分隔线。有几种交互方式，让我展示出来——请打开 **http://localhost:62307**

- 检查现有 brainstorm 会话，发现已有会话 `http://localhost:51108`（但服务器已死）
- 尝试重启服务器失败
- 重新启动新服务器成功：`http://localhost:63381`

请打开 **http://localhost:63381** 查看三种切词交互方案。

三种方案简述：

- **A** — 点击字符间的热区切分，最直接但热区窄
- **B** — 点选词块后用按钮/快捷键拆分合并，键盘友好
- **C** — 仿文本编辑器光标，方向键移动 + Space 切分（但 Space 与播放键冲突）

附：C 选项结构及样式

```xml
<div class="option" data-choice="c" onclick="toggleSelect(this)">
  <div class="letter">C</div>
  <div class="content">
    <h3>混合：字符级点击 + 键盘快捷键</h3>
    <p>词块展开为独立字符卡片，左右方向键移动光标，<kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:12px;">Space</kbd> 在光标位置切分，<kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:12px;">Backspace</kbd> 合并左侧。也可直接点击字符间竖线。仿文本编辑器光标体验。</p>
    <div style="margin-top:10px;background:#1a1a2e;border-radius:6px;padding:12px 16px;font-family:monospace;font-size:15px;">
      <div style="display:flex;align-items:center;gap:0;">
        <span style="background:#2d4a7a;color:#90c0ff;padding:4px 8px;border-radius:4px 0 0 4px;">想</span>
        <span style="background:#2d4a7a;color:#90c0ff;padding:4px 8px;">起</span>
        <span style="width:2px;height:28px;background:#4a9eff;"></span>
        <span style="background:#2d4a7a;color:#90c0ff;padding:4px 8px;">你</span>
        <span style="background:#2d4a7a;color:#90c0ff;padding:4px 8px;">那</span>
        <span style="background:#2d4a7a;color:#90c0ff;padding:4px 8px;">笑</span>
        <span style="background:#2d4a7a;color:#90c0ff;padding:4px 8px;border-radius:0 4px 4px 0;">容</span>
        <span style="margin-left:12px;font-size:11px;color:#666;">光标在"起"和"你"之间，按 Space 切分</span>
      </div>
    </div>
    <div class="pros-cons" style="margin-top:8px;">
      <div class="pros"><h4>优点</h4><ul><li>键盘全程可操作</li><li>光标位置直观</li></ul></div>
      <div class="cons"><h4>缺点</h4><ul><li>实现最复杂</li><li>Space 键需与打轴 Space（播放）区分</li></ul></div>
    </div>
  </div>
</div>
```

---

**用户**:  
仿aegisub，纯鼠标操作，类似C的样式，但是鼠标点击切分，再点击分隔线取消切分

**Agent**:  
（无文本回复，等待进一步输入）

---

**用户**:  
如上

**Agent**:  
确认 **C — 数值编辑区集成在底部 WordSplitBar 内**，选中词块时面板内展示该词的 startTime / endTime 可编辑输入框。与切词操作在同一区域，不需要额外弹窗或侧边栏。

---

最后一个关键问题：**歌词输入入口**

支持粘贴 + 导入文件 + 手动输入三种方式，这三个入口放在哪里：

- **A）歌词列表顶部工具栏** — 列表上方有「粘贴歌词」「导入文件」「添加行」三个按钮，始终可见
- **B）空状态引导** — 歌词列表为空时显示大号引导区，提示粘贴/导入；有内容后工具栏收缩为小图标
- **C）MenuBar 菜单项** — 粘贴/导入走「文件」菜单，与导入音频同级；歌词列表只做展示和选中

---

**用户**:  
B，但是不做小图标，做进MenuBar

**Agent**:  
确认：**空状态引导区 → 内容后入口移入 MenuBar**，歌词列表纯展示 + 选中。

---

信息已经充分了。现在来提 2-3 个整体架构方案，让你选方向。

---

**Phase 4 歌词打轴的核心架构问题**是：歌词编辑的会话状态（当前激活行、当前打到第几个词、切词面板选中状态）放在哪里管理。三个方案：

**方案 A（推荐）— 专用 `useLyricsEditor` composable**  
新建一个 composable 持有所有歌词编辑会话状态（`activeLineId`、`activeWordIndex`、`splitBarSelectedWordId`），挂在 `AppShell` 里，用 `provide/inject` 传给子组件。Commands 仍走 `editor-store.execute()`，只有 UI 交互状态在 composable 里。保持 store 专注于持久化数据，composable 专注于交互流程。

**方案 B — 扩展 editor-store**  
直接在现有 `editor-store` 里加 `activeLyricLineId` / `activeWordIndex` 等 ref。简单直接，但 store 会变得更大，且这些纯 UI 状态不应该被持久化/undo。

**方案 C — 独立 `lyrics-store`**  
新建一个 Pinia store 专管歌词编辑会话。和 A 类似的职责分离，但用 store 而不是 composable，可以在 DevTools 里观察状态，但引入了第二个 store。

**我推荐 A**：和现有 `useTimelineView` 的模式完全一致（composable 管 UI 状态，provide 给子树），不污染 store，测试也容易。  
你倾向哪个方向？

---

**用户**:  
这个问题A，然后一开始的几个问题，我在这里回答你：Undo粒度是每次D一个独立command；切词的粒度也是每次切分一个Command；重打轴行为是直接从当前行开始。先多为我考虑几个EdgeCase再来确认实现，比如音乐暂停的时候按D键是什么行为？这个问题我的回答是从当前句开头（如果有起始时间）直接播放之后跳到第二个词上，再按就覆盖第二个词的当前时间，另外要检查按了之后是否覆盖到了第四个词的开头（第三个词的结尾），如果是，则要继续想好怎么处理这种情况；如果当前句开头没有起始时间就把当前播放位置作为起始时间

**Agent**:  
好，整理一下确认的内容，然后列出我发现的 Edge Case 让你逐一确认。

**已确认：**

- 暂停时按 D（行有起始时间）→ seek 到行起点播放，推进到第二个词，下次 D 覆盖第二词 endTime
- 暂停时按 D（行无起始时间）→ 当前播放位置作为 startTime

**覆盖到后续词的情况（你提的）**：  
按 D 设置了词 N 的 endTime，但这个时间已经超过词 N+2 的 startTime（跳过了词 N+1）。  
我的推荐：**清空被跳过词的时间，直接推进到第一个未计时的词**。即词 N+1 的时间被清除，activeWordIndex 跳到 N+2。

---

**其他 Edge Case 请你确认：**

1. **播放中用户手动 seek 到更早的位置** — activeWordIndex 是否重置到第一个未计时词？还是保持当前位置？

2. **播放中点击另一行** — 中断当前行的打轴？还是禁止切换（锁定当前行直到按 Enter）？

3. **D 键按在最后一个词上** — 行为等同 Enter（设 endTime + 进下一行）？还是只设 endTime 停在当前行？

4. **Enter 按在最后一行** — 自动新建一行？还是只是结束打轴模式？

5. **词块拖拽边界时产生负时长（左边界超过右边界）** — 禁止拖过去（硬限制）？还是允许但视为无效状态？

---

**用户**:  
先指出你刚刚的回答存在的问题，我现在的想法是词块只需要有startTime或者endTime一个属性，每个词块只能紧密拼在一起；关于你说的覆盖后续词的情况，我的想法是只清除N+1及后面可能覆盖到的分词时间，之后active word保留在N+1上。你提出的edge case我逐一回答：1. 播放中seek如果出了该句的起始位置，不在seek时判断，按D键时才处理这种情况，如果该句的startTime比当前进度晚，那直接设置到播放进度位置（同时设置第一个词的startTime，如果你决定用startTime的话），同时activeWordIndex重置到第二个词；2. 保持播放状态，直接将播放进度跳转到当前行起始；3. 停在当前行；4. 不产生任何操作；5. 硬限制，禁止拖拽，同时要做好这方面的校验。

**Agent**:  
好，先指出几个问题，然后确认 Edge Case。

---

**你说的关键点让我发现了一个域模型问题：**

当前 `LyricWord` 有 `startTime` 和 `endTime` 两个字段——与"只需一个时间属性、紧密拼接"矛盾。需要改为：

```ts
interface LyricWord {
  id: string
  text: string
  startTime?: number // 该词的起点（= 上一词的终点）
}

interface LyricLine {
  id: string
  text: string
  words: LyricWord[]
  startTime?: number // = words[0].startTime，冗余存储方便查询
  endTime?: number // 最后一词的终点，由 Enter 设置
}
```

D 键语义变为：**设置 words[activeIndex + 1].startTime = currentTime，activeIndex 推进**。最后一次 D（最后一词）只推进 activeIndex 停在末尾等 Enter。

---

**Edge Case 确认：**

1. ✅ D 时才判断 seek 越界，若行 startTime 晚于当前进度 → 用当前进度覆盖 words[0].startTime + line.startTime，activeIndex = 1
2. ✅ 点击另一行 → 保持播放，seek 到该行起始
3. ✅ D 在最后一词 → 只设时间，停在当前行
4. ✅ Enter 在最后一行 → 无操作
5. ✅ 拖拽边界硬限制，严格校验

**关于覆盖后续词**：清除 N+1 及之后被覆盖的 startTime，activeIndex 停在 N+1。✅

---

还有两个 Edge Case 想请你确认：

**6. 切词面板取消分割时的时间处理** — 合并 word[i] 和 word[i+1]，若 word[i+1] 已有 startTime，合并后这个时间点直接丢弃，合并词的 startTime = word[i].startTime？

**7. 已打完时间的行，用户在切词面板增加新的切分** — 比如原来"想起你" 3个词都有时间，用户在"想"和"起"之间插入新分割，新词的 startTime 是 undefined（待打），还是自动插值？

---

**用户**:  
只留endTime吧，这样用户好操作，可以用户自己选activeWord的操作做铺垫，按D就设置当前词的endTime，当activeWordIndex为最后一个时，按D不执行任何操作，按Enter设置最后一个词的endTime，同时设置当前行的endTime；6. 直接取后面词的endTime；7. 自动插中值（跟随网格吸附）

**Agent**:  
完美，数据模型现在非常清晰了：

```ts
interface LyricWord {
  id: string
  text: string
  endTime?: number // 该词结束时间；起点 = 上一词 endTime 或 line.startTime
}

interface LyricLine {
  id: string
  text: string
  words: LyricWord[]
  startTime?: number // 句子起点（进入该行时设置）
  endTime?: number // 句子终点（Enter 时设置，= 最后一词 endTime）
}
```

**Edge Case 全部确认：**

- D：设置 `words[activeIndex].endTime`，activeIndex++；最后一词时 D 无操作
- Enter：设置 `words[last].endTime` = `line.endTime`，进下一行
- 合并词：取后面词的 endTime
- 插入新切分（已有时间）：自动插中值并吸附网格

---

还有两个小问题确认后就可以进入设计文档了：

**8. 用户手动点击 WordSplitBar 中的某个词** — 点击即设为 activeWord（可以在暂停时手动定位，然后按 D 覆盖）？

**9. 当前行 `startTime` 是由什么动作设置的？** 我的理解是：点击行（C 方案 seek）时设置；若行已有 startTime 则不覆盖——是这样吗？

---

**用户**:  
8. 对，在切词栏里点，可以把切词栏左边加个剪刀图标的按钮，可以切换激活状态，等不是剪刀的状态用户就可以选activeWord（要适配热键操作，尽管现在暂时没有热键）；9. 要不让activeWordIndex为0时指向当前行的startTime，为1时指向第一个词的endTime以此类推

**Agent**:  
（无文本回复，等待补充输入）

---

**用户**:  
9补充：在切词栏的选中模式中，在最前面加一个该行最起始点的块，选中这个块时设置这行的startTime，同时activeIndex+1，之后就是依次设置词的endTime

**Agent**:  
完美，`activeWordIndex` 的语义非常清晰：

| activeIndex | 操作目标                                   |
| ----------- | ------------------------------------------ |
| 0           | `line.startTime`                           |
| 1           | `words[0].endTime`                         |
| 2           | `words[1].endTime`                         |
| …           | …                                          |
| N           | `words[N-1].endTime`（最后一词，D 无操作） |

WordSplitBar 有两个模式，左侧图标切换：

- ✂️ **剪刀模式**：点击字符间隙插入/取消分割
- 🖱️ **选中模式**：点击词块设置 activeWord（含起始块），支持未来热键扩展

起始块是一个特殊的伪词块，显示在最前面，选中它按 D = 设置 `line.startTime`。

---

我已经掌握了足够信息，准备展示设计方案。现在进入 **分节展示设计** 阶段：

---

**第一节：数据模型变更**

`LyricWord` 去掉 `endTime` 以外的所有时间字段，`LyricLine` 增加 `startTime` / `endTime`：

```ts
interface LyricWord {
  id: string
  text: string
  endTime?: number // 该词结束点；词起点 = 上一词 endTime 或 line.startTime
}

interface LyricLine {
  id: string
  text: string
  words: LyricWord[]
  startTime?: number // 句起点
  endTime?: number // 句终点 = words[last].endTime，Enter 时写入
}
```

现有 `ProjectDocument.lyrics: LyricLine[]` 结构不变，`domain/project.ts` 只做字段增删。  
这一节设计你看 OK 吗？

---

**用户**:  
LyricLine的endTime也删掉

**Agent**:  
确认，`line.endTime` 是冗余的——直接读 `words[last].endTime` 即可。最终模型：

```ts
interface LyricWord {
  id: string
  text: string
  endTime?: number // 词终点；词起点 = 上一词 endTime 或 line.startTime
}

interface LyricLine {
  id: string
  text: string
  words: LyricWord[]
  startTime?: number // 句起点
}
```

✅ 第一节确认。

---

**第二节：组件结构**

```
AppShell
├── MenuBar          （新增「歌词」菜单：粘贴/导入/添加行）
├── MainView         （波形层不变；歌词模式下叠加 LineOverlay：句子区间 + 词块分隔线）
├── TransportBar     （不变）
└── LyricsPanel      （歌词模式下替换 TimingPointsPanel）
    ├── LyricsLineList   （行列表：行号/startTime/词块状态预览/三态高亮）
    └── WordSplitBar     （底部切词+打轴面板，始终展示）
        ├── [✂/👆 切换按钮]
        ├── [起始块] + [词块列表]   （剪刀模式：点击间隙切割；选中模式：点击激活）
        └── [选中词的 startTime / endTime 数值编辑]  （仅选中模式，选中词时展示）
```

会话状态由新建的 `useLyricsEditor` composable 管理，`provide` 给 LyricsPanel 子树：

- `activeLineId`
- `activeWordIndex`（0 = 起始块，1…N = 词）
- `splitBarMode: 'cut' | 'select'`

这一节 OK 吗？

---

**用户**:  
好

**Agent**:  
✅ 第二节确认。

---

**第三节：Commands 与 Store Actions**

**新增 Commands（`core/commands/project-commands.ts`）：**

| Command                         | 操作                                        |
| ------------------------------- | ------------------------------------------- |
| `createUpdateLyricLineCommand`  | 修改 line（startTime / words 数组）         |
| `createSetWordEndTimeCommand`   | 设置单个词的 endTime                        |
| `createSplitWordCommand`        | 切词：一个词变两个                          |
| `createMergeWordsCommand`       | 合并：words[i] + words[i+1]，取后者 endTime |
| `createSetLineStartTimeCommand` | 设置 line.startTime                         |
| `createInsertLyricLineCommand`  | 粘贴/导入时批量建行                         |
| `createRemoveLyricLineCommand`  | 删除行                                      |

**Store 新增 actions（`editor-store.ts`）：**

- `setWordEndTime(lineId, wordId, time)`
- `setLineStartTime(lineId, time)`
- `splitWord(lineId, wordId)` — 切词，中值插值时需传入 snapTime
- `mergeWords(lineId, wordId)` — 合并当前词与下一词
- `insertLyricLines(lines: LyricLine[])` — 粘贴/导入入口
- `removeLyricLine(lineId)`

打轴逻辑（D / Enter 的判断、activeWordIndex 推进、越界处理、清除后续词）全部在 `useLyricsEditor` composable 里处理，**不进 store**——store 只负责 Command dispatch，composable 负责交互状态机。

这一节 OK 吗？

---

**用户**:  
好，后续有需求再加

**Agent**:  
✅ 第三节确认。

---

**第四节：边界校验与错误处理**

**时间校验规则（在 Command 层强制）：**

- `word.endTime` 必须 > `line.startTime`（或上一词 endTime）
- `word.endTime` 必须 ≤ 音频总时长
- 拖拽边界：`words[i].endTime` 不得超过 `words[i+1].endTime`（硬限制，拖拽层 clamp）
- 插值新切分：中值吸附到最近网格线，若两端时间相同则拒绝切分

**吸附：**  
所有 D 键写入时间、拖拽释放时间均经过 `snapToGrid(time, timingPoints, divisor, triplets)`（复用 Phase 3 已有逻辑）

**测试重点：**

- `createSplitWordCommand` / `createMergeWordsCommand` 的 do/undo 正确性
- `useLyricsEditor` 状态机：D 键推进、越界清除、暂停时 D 的 seek 行为
- 校验拒绝非法时间（负时长、超出音频）

这一节 OK 吗？

---

**用户**:  
好

**Agent**:  
✅ 四节全部确认。现在写设计文档。现在做 spec 自检：

- 读取了 `2026-05-20-phase-4-lyrics-timing-design.md`
- 自检发现两处需要修正（第 2 节描述有歧义、第 5 节 Enter 逻辑未说明 activeWordIndex 不在末尾时的行为）
- 执行 git commit 提交设计文档

Spec 已写入并提交：`docs/superpowers/specs/2026-05-20-phase-4-lyrics-timing-design.md`

请花一点时间审阅这个文件，重点看一下：

- **第 5 节**的 D / Enter 状态机是否和你预想的一致
- **第 7 节** WordSplitBar 的切词中值插值与合并规则

有任何要修改的地方告诉我，确认后我们就进入 writing-plans 制定实现计划。

---

**用户**:  
/test-driven-development 开始writng-plans。你写好后我会交给其他没有本次上下文的Agent执行，所以重要的点请尽量写详细

**Agent**:

- 调用 skill: test-driven-development
- 调用 skill: writing-plans
- 读取 spec 文件
- 读取 `command.ts`
- 读取 `useTimelineView.ts`
- 读取 `history.ts`
- 读取 `useEditorShortcuts.ts`
- 读取 `MainView.vue`
- 读取 `injection-keys.ts`
- 读取 `MenuBar.vue`
- 读取 `i18n` 目录
- 读取 `registry.ts`
- 读取 `timing-engine.ts` 第 1–50 行

（Agent 正在读取代码以撰写详细计划，但对话记录在此处截断）

---

**用户**:  
继续

**Agent**:  
（仍在处理中，对话记录未提供后续回复）

---

**注意**：最后一个轮次 Agent 尚未完成回复，实际 plan 并未在给定记录中输出。如需后续内容，可继续向 Agent 发送请求。
