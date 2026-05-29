# Shortcut Customization Design

Phase 5 Plus · Part 8 · 快捷键自定义

## 背景与目标

允许用户在「首选项 → 快捷键」面板内查看与修改全局快捷键，把覆盖持久化到浏览器本地存储。改造现有 `platform/shortcuts/` 与 `useEditorShortcuts`，让默认绑定可被用户覆盖，重置后仍可恢复默认。

### 设计原则

- **每个动作 ↔ 0 或 1 个键位**。完全消除“多绑定”特例：副键位由独立动作（如 `lyrics.mark2`）承载，dispatcher 把它们路由到同一个 handler。
- **三态语义**：`undefined`（用默认）/ `null`（用户主动清空）/ `string`（覆盖为指定键位）。
- **冲突自动重分配**：用户把已被占用的键位分配给新动作时，旧动作被让位为 `null`，并通过 StatusBar 提示。
- **快捷键配置不进入项目 command history**。它属于本地用户偏好，与音量/locale 等一致，不可 undo/redo。
- **业务逻辑可独立测试**：合并、冲突、重置都集中在 `useShortcutBindings`，不漏到组件层。

### 验收要点

- 重置后默认快捷键仍可用。
- 输入框、文本域、下拉框中不触发全局快捷键（保留现有 `shouldIgnoreShortcutTarget`）。
- `normalizeKeystroke()` 的 IME 组合输入守卫保持有效。
- 快捷键覆盖保存到 `LocalStorage`（归入 `LocalUserState`，**不**进入“备份/恢复”导出文件）。
- `lyrics.mark` 默认 `D`，新增 `lyrics.mark2` 默认 `S`，二者通过同一 handler 执行 mark 行为。
- StatusBar 报告冲突重分配、单项重置、全部重置等操作。

## 架构总览

```txt
src/platform/shortcuts/
├── keystroke.ts         # 保持不变，IME-safe normalizer
├── registry.ts          # 改造：新增 rebuild(map)；保留 register/unregister/dispatch
├── defaults.ts          # ★新增 DEFAULT_SHORTCUT_BINDINGS: Record<ShortcutAction, string|null>
├── overrides.ts         # ★新增 schema + mergeBindings(defaults, overrides) + 反向索引
├── capture.ts           # ★新增 isCapturableKeystroke()
└── *.spec.ts            # 新增 defaults/overrides/capture 单测，并扩展 registry.spec

src/composables/
├── useEditorShortcuts.ts        # 改造：接受 bindings + paused 输入；watch 重建 registry
├── useShortcutBindings.ts       # ★新增 数据源 + 合并 + 冲突重分配 + 重置
└── useShortcutCapture.ts        # ★新增 编辑 UI 用：开始捕获、记录下一次 keydown、取消

src/platform/settings/
└── local-settings.ts            # 在 LocalUserState 加 shortcutOverrides 字段

src/components/shell/
├── PreferencesModal.vue         # shortcuts panel：从 placeholder → 真实列表 + 全部重置
├── ShortcutBindingRow.vue       # ★新增 单行：动作名 + 当前绑定 + 捕获按钮 + 单项重置
└── AppShell.vue                 # 串联 useShortcutBindings → useEditorShortcuts → PreferencesModal
```

依赖关系：

```
useShortcutBindings  (source of truth, owns overrides + merges)
    ↓ effectiveBindings & bindingsByKeystroke & mutators
    ├── useEditorShortcuts  (consumes bindings, dispatches, honors `paused`)
    └── PreferencesModal    (renders rows, invokes mutators, owns capture state)
```

## 数据模型

### `ShortcutAction`

在 `registry.ts` 现有 union 上新增一项：

- `lyrics.mark2` —— 副 mark 键位，dispatcher 与 `lyrics.mark` 共享 handler。

### `DEFAULT_SHORTCUT_BINDINGS`

定义在 `platform/shortcuts/defaults.ts`，类型 `Record<ShortcutAction, string | null>`：

| Action                    | Default            |
| ------------------------- | ------------------ |
| `history.undo`            | `Ctrl+Z`           |
| `history.redo`            | `Ctrl+Y`           |
| `project.save`            | `Ctrl+S`           |
| `transport.togglePlay`    | `Space`            |
| `transport.prevBeat`      | `ArrowLeft`        |
| `transport.nextBeat`      | `ArrowRight`       |
| `transport.prevBar`       | `Shift+ArrowLeft`  |
| `transport.nextBar`       | `Shift+ArrowRight` |
| `timing.tapBpm`           | `B`                |
| `metronome.toggle`        | `M`                |
| `lyrics.mark`             | `D`                |
| `lyrics.mark2`            | `S`                |
| `lyrics.markNoAdvance`    | `Shift+D`          |
| `lyrics.nextLine`         | `Enter`            |
| `lyrics.playLineInterval` | `C`                |
| `lyrics.playWordInterval` | `V`                |
| `lyrics.deleteLine`       | `Delete`           |
| `lyrics.clearSelection`   | `Escape`           |
| `lyrics.editWholeLine`    | `Tab`              |

### `ShortcutOverrides`

```ts
type ShortcutOverrides = Partial<Record<ShortcutAction, string | null>>
```

zod schema：

```ts
shortcutOverrides: z.record(z.string(), z.string().nullable()).default({})
```

zod 在运行时不收紧到 `ShortcutAction` union（字符串足够）。未知 key 通过 schema 不会被拒，但合并阶段会忽略 `DEFAULT_SHORTCUT_BINDINGS` 中不存在的 action。

### 合并语义

| `overrides[A]`            | `effectiveBindings[A]`         | 含义                 |
| ------------------------- | ------------------------------ | -------------------- |
| `undefined`（key 不存在） | `DEFAULT_SHORTCUT_BINDINGS[A]` | 用默认               |
| `null`                    | `null`                         | 用户主动清空，无绑定 |
| `'X'`                     | `'X'`                          | 覆盖为 X             |

`mergeBindings(defaults, overrides)` 返回新对象，不可变。

`bindingsByKeystroke(effective)` 返回 `Map<string, ShortcutAction>`，跳过 `null` 项；默认值为 `null` 的 action（理论上无）也不收录。

## 持久化

加进 `LocalUserState`（**不**进入备份导出），schema 在 `src/platform/settings/local-settings.ts`：

```ts
shortcutOverrides: z.record(z.string(), z.string().nullable()).default({})
```

- 通过现有 `useLocalSettings` 的 `watch → service.save` 管线持久化
- `applySettings()` 中从 `nextState.shortcutOverrides` 注水到 ref
- `buildState()` 中读取 ref 写回
- 校验失败（损坏值）⇒ 整个 LocalUserState 走 `loadFailed` 提示，回落默认（沿用现有行为）

## `platform/shortcuts/registry.ts` 改造

- 保留 `register / unregister / dispatch`
- 新增 `rebuild(map: Map<string, ShortcutAction>): void`：清空内部 `bindings`，把传入 map 的条目批量塞入
- 拒绝重复 keystroke：rebuild 期间发生重复时丢弃后续项（不应出现，由 `useShortcutBindings` 保证；用 `console.warn` 输出诊断信息，便于回归排查）

## `useShortcutBindings` composable

### 输入

```ts
interface UseShortcutBindingsOptions {
  initialOverrides: Ref<ShortcutOverrides>
  onChange: (next: ShortcutOverrides) => void
  onStatus: (key: string, params?: Record<string, string | number>) => void
}
```

### 输出

```ts
interface UseShortcutBindingsReturn {
  effectiveBindings: ComputedRef<Record<ShortcutAction, string | null>>
  bindingsByKeystroke: ComputedRef<Map<string, ShortcutAction>>

  assignBinding(action: ShortcutAction, keystroke: string): AssignResult
  clearBinding(action: ShortcutAction): void
  resetAction(action: ShortcutAction): void
  resetAll(): void
}

type AssignResult =
  | { ok: true; reassignedFrom: ShortcutAction | null }
  | { ok: false; reason: 'sameBinding' }
```

### `assignBinding(A, K)`

1. 查 `bindingsByKeystroke.value.get(K)` ⇒ `existingAction`
2. `existingAction === A` ⇒ 返回 `{ok:false, reason:'sameBinding'}`，不写 override，不发 status
3. `existingAction && existingAction !== A` ⇒
   - 构造 `next = { ...current, [existingAction]: null, [A]: K }`
   - 一次性 `onChange(next)`（避免中间态触发两次 watch）
   - `onStatus('status.shortcuts.reassigned', { keystroke, fromLabel, toLabel })`
   - 返回 `{ ok:true, reassignedFrom: existingAction }`
4. 无冲突 ⇒
   - `next = { ...current, [A]: K }`
   - `onChange(next)`
   - `onStatus('status.shortcuts.assigned', { actionLabel, keystroke })`
   - 返回 `{ ok:true, reassignedFrom: null }`

注意：被让位的动作变成 `null`（unbound），**不**回落默认 —— 避免“我把 D 重分给别人，结果原动作捡回别的默认”的连锁。

### `clearBinding(A)`

`next = { ...current, [A]: null }` → `onChange` → `onStatus('status.shortcuts.cleared', { actionLabel })`。

### `resetAction(A)`

- 若 `current[A] === undefined` ⇒ short-circuit，不发 status
- 构造 `next` 删除 key
- 若回落后的默认值 `K = DEFAULT_SHORTCUT_BINDINGS[A]` 不为 `null` 且与 `effective` 中其他动作冲突 ⇒ 把那个动作在 `next` 中设为 `null`（让位）
- `onChange(next)` → `onStatus('status.shortcuts.reset', { actionLabel })`
  （让位若发生，仍只发一次 reset status；不冗余发 reassigned）

### `resetAll()`

- 若 `current === {}` ⇒ short-circuit
- `onChange({})`
- `onStatus('status.shortcuts.resetAll')`

### 不变量

- mutator 都构造新对象后调 `onChange`，不直接 mutate `initialOverrides.value`
- `effectiveBindings` 是 `computed(() => merge(DEFAULTS, initialOverrides.value))`，自动反应

## `useEditorShortcuts` 改造

### 输入

```ts
interface UseEditorShortcutsOptions {
  bindings: ComputedRef<Map<string, ShortcutAction>>
  paused: ComputedRef<boolean>
  onAction: (action: ShortcutAction) => void | Promise<void>
  onError?: (error: unknown, action: ShortcutAction) => void
}
```

### 行为

- 内部不再硬编码 `registry.register(...)`
- `watch(bindings, (next) => registry.rebuild(next), { immediate: true })`
- `onKeydown` 首条短路：`if (paused.value) return`
- `shouldIgnoreShortcutTarget` 保留
- `normalizeKeystroke` 保留（IME 守卫）
- `dispatch` 逻辑不变

### Mark handler 共享

AppShell 的 `onAction` 分支调整：

```ts
if (action === 'lyrics.mark' || action === 'lyrics.mark2') {
  if (editorMode.value === 'lyrics') lyricsEditor.handleMarkKey()
}
```

其他分支保持不变。

## `useShortcutCapture` composable

### 输入

```ts
interface UseShortcutCaptureOptions {
  onCaptured: (action: ShortcutAction, keystroke: string) => void
  onCancelled: (action: ShortcutAction) => void
}
```

### 输出

```ts
interface UseShortcutCaptureReturn {
  capturingAction: Ref<ShortcutAction | null>
  start(action: ShortcutAction): void
  cancel(): void
}
```

### 行为合约

- `start(A)`：
  - 若已有 `capturingAction.value !== null` ⇒ 先 `cancel()`
  - 写 `capturingAction.value = A`
  - 在 `window` 上注册 `keydown` 捕获器（`{ capture: true }`）
- 捕获器内：
  1. `event.preventDefault(); event.stopPropagation()` —— 不让捕获键触发其他动作
  2. `normalizeKeystroke(event) === null`（IME）⇒ 继续等下一次 keydown
  3. `isCapturableKeystroke(event)` 过滤：
     - 纯修饰键（`event.key in {Meta, Control, Alt, Shift}`）⇒ 继续等
     - `event.key === 'Escape'` ⇒ 调 `onCancelled(A)`，清状态退出
     - 否则 ⇒ 调 `onCaptured(A, keystroke)`，清状态退出
- `cancel()` ⇒ 同 Escape 路径（如果当前有捕获中动作）
- `onUnmounted` ⇒ 强制移除 listener

### `isCapturableKeystroke` 真值表

| 输入                          | 返回                                  |
| ----------------------------- | ------------------------------------- |
| `{key:'Shift'}`               | `false`（纯修饰）                     |
| `{key:'Control'}`             | `false`                               |
| `{key:'a', shiftKey:true}`    | `true`                                |
| `{key:'Escape'}`              | `false`（保留给取消语义）             |
| `{key:'a', isComposing:true}` | `false`（双保险，normalize 阶段已挡） |
| `{key:'Enter'}`               | `true`                                |

注：Escape 默认绑定为 `lyrics.clearSelection`。这里的“Escape 不可捕获”仅指**捕获 UI 内**Escape 用于取消，不影响默认绑定的存在。

## PreferencesModal 改造

### 布局

替换原有 `preferences.shortcutsPlaceholder` 占位，渲染快捷键列表：

```
┌─ 快捷键 ───────────────────────────────────────────┐
│                                      [全部重置]    │
│                                                    │
│  撤销                Ctrl+Z          [⌨️] [↺]      │
│  重做                Ctrl+Y          [⌨️] [↺]      │
│  ...                                               │
│  打轴 Mark           D               [⌨️] [↺]      │
│  打轴 Mark（副）     S               [⌨️] [↺]      │
│  ...                                               │
└────────────────────────────────────────────────────┘
```

- 滚动 `<ul>`，每行 `ShortcutBindingRow.vue`
- `[⌨️]` 进入捕获，`[↺]` 单项重置（仅在该动作处于覆盖状态时可点）
- 无绑定（`effective[action] === null`）显示斜体 `未绑定`
- 顶部「全部重置」点击后弹原生 `confirm()` 二次确认（与现有 modal 风格一致，不引入第三方对话框）

### `ShortcutBindingRow.vue`

```ts
defineProps<{
  action: ShortcutAction
  effectiveKeystroke: string | null
  isOverridden: boolean
  capturing: boolean
}>()

defineEmits<{
  startCapture: [action: ShortcutAction]
  cancelCapture: []
  reset: [action: ShortcutAction]
  clear: [action: ShortcutAction]
}>()
```

- 行展示动作 i18n 名（通过 `ACTION_LABEL_KEYS` 映射）
- 当前键位 / `未绑定`
- 右侧按钮：捕获、单项重置
- 进入捕获状态后：整行加 `ring-2 ring-primary`，键位区显示 `按下键位...`；右侧按钮变为 `取消` + `清空`

## AppShell 接线

```ts
// 1. useLocalSettings 多 own 一个 ref
const localSettings = useLocalSettings({
  ...,
  // 内部新增字段，从 LocalUserState 加载/写回
})

// 2. 装配 bindings 数据源
const shortcuts = useShortcutBindings({
  initialOverrides: localSettings.shortcutOverrides,
  onChange: (next) => { localSettings.shortcutOverrides.value = next },
  onStatus: (key, params) => store.showStatus(key, params),
})

// 3. 捕获 composable
const capture = useShortcutCapture({
  onCaptured: (action, keystroke) => shortcuts.assignBinding(action, keystroke),
  onCancelled: () => { /* no-op：不发 status */ },
})

// 4. 改造 useEditorShortcuts 输入
useEditorShortcuts({
  bindings: shortcuts.bindingsByKeystroke,
  paused: computed(() => capture.capturingAction.value !== null),
  onAction: async (action) => { /* mark/mark2 共享 + 其他分支保留 */ },
})
```

PreferencesModal 接线（增量 props/emits）：

```
:shortcut-bindings="shortcuts.effectiveBindings.value"
:shortcut-overridden-actions="overriddenActionsSet"
:capturing-action="capture.capturingAction.value"
@startCaptureShortcut="capture.start"
@cancelCaptureShortcut="capture.cancel"
@resetShortcut="shortcuts.resetAction"
@clearShortcut="shortcuts.clearBinding"
@resetAllShortcuts="onResetAllShortcuts"  // 内部弹 confirm() 再调 shortcuts.resetAll
```

`overriddenActionsSet = computed(() => new Set(Object.keys(localSettings.shortcutOverrides.value)))`，传给 row 决定 `[↺]` 是否可点。

modal 关闭时若 `capturingAction !== null`，AppShell 在 `@close` 处理函数里先调 `capture.cancel()` 再关 modal，防止监听器泄漏。

## 错误处理与边界

- `useShortcutBindings` 所有 mutator 都是纯函数式更新，不抛错；同绑定短路返回 `{ok:false, reason:'sameBinding'}`，UI 静默处理
- `useShortcutCapture` 中 `normalizeKeystroke` 返回 `null` 时**继续等**，不退出捕获 —— IME 切换瞬间按键不会被吞
- `local-settings.ts` parse 失败 ⇒ 整个 state 回落默认（沿用现有 `loadFailed`）
- PreferencesModal 关闭 ⇒ 强制 `capture.cancel()`

### 边界 case 清单（每条对应一个测试）

| 场景                                                               | 期望                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 把 `lyrics.mark2` 分配为 `D`（与 `lyrics.mark` 默认冲突）          | `lyrics.mark` 让位为 `null`，发 reassigned status                     |
| 重置 `lyrics.markNoAdvance` 回落 `Shift+D`，但该键已被用户绑给别处 | 别处让位为 `null`，目标恢复默认；发 reset status（不冗余 reassigned） |
| 用户给 `history.undo` 分配 `D`（与 `lyrics.mark` 默认冲突）        | `lyrics.mark` 让位为 `null`；按 D 不再触发 mark                       |
| 重置已是默认状态的动作                                             | mutator short-circuit，无 status                                      |
| 全部重置时弹 confirm，用户取消                                     | 不动 overrides                                                        |
| 捕获中按 `Shift` 单独                                              | 不捕获，等下一次组合键                                                |
| 捕获中按 `Escape`                                                  | cancel，无 status                                                     |
| 捕获中 modal 被关                                                  | AppShell @close 先 cancel 再关                                        |
| 输入框聚焦时按 `D`                                                 | `shouldIgnoreShortcutTarget` 短路                                     |
| IME 组合输入态按键                                                 | `normalizeKeystroke` 返回 null，不分发也不退出捕获                    |
| `paused=true` 期间按全局键                                         | `useEditorShortcuts` 短路；捕获器吃下事件                             |
| 删除 localStorage 后刷新                                           | shortcutOverrides 走默认 `{}`，所有动作回落 DEFAULT_SHORTCUT_BINDINGS |

## i18n 新增

`src/i18n/locales/zh-CN.json`：

```
preferences.shortcuts.title:           "快捷键"   // 复用 categories.shortcuts
preferences.shortcuts.resetAll:        "全部重置"
preferences.shortcuts.resetAllConfirm: "确定要重置所有快捷键到默认值吗？"
preferences.shortcuts.reset:           "重置"
preferences.shortcuts.assign:          "分配快捷键"
preferences.shortcuts.cancelCapture:   "取消"
preferences.shortcuts.clear:           "清空"
preferences.shortcuts.unbound:         "未绑定"
preferences.shortcuts.capturing:       "按下键位..."

status.shortcuts.assigned:    "已分配 {actionLabel} → {keystroke}"
status.shortcuts.reassigned:  "{keystroke} 已从 {fromLabel} 重新分配给 {toLabel}"
status.shortcuts.cleared:     "已清空 {actionLabel} 的快捷键"
status.shortcuts.reset:       "已重置 {actionLabel} 的快捷键"
status.shortcuts.resetAll:    "已重置全部快捷键"

actions.lyricsMark2:          "打轴 Mark（副）"
```

并把 `actions.lyricsMark2` 加进 `ACTION_LABEL_KEYS`（`src/i18n/status-label-maps.ts`）。

## 测试矩阵

### 新文件

- `src/platform/shortcuts/defaults.spec.ts`
  - 19 个 action 都有默认（含 `lyrics.mark2 = 'S'`）
  - 与文档化期望一致的快照
- `src/platform/shortcuts/overrides.spec.ts`
  - merge：`undefined → 默认`、`null → null`、`string → string`
  - `bindingsByKeystroke` 跳过 `null` 项
  - 默认值含 `null` 时反向索引不收录
- `src/platform/shortcuts/capture.spec.ts`
  - `isCapturableKeystroke` 真值表
- `src/composables/useShortcutBindings.spec.ts`
  - `assignBinding` 三条路径（同绑定短路 / 冲突重分配 / 无冲突）
  - 冲突重分配同帧写两条 override（仅一次 `onChange`）
  - `clearBinding` 写入 `null`
  - `resetAction` 删 override；遇默认冲突触发让位（一次 reset status）
  - `resetAction` 已是默认状态 ⇒ short-circuit
  - `resetAll` 清空 overrides；已是空 ⇒ short-circuit
  - `onStatus` 调用次数与参数
- `src/composables/useShortcutCapture.spec.ts`
  - `start → keydown(普通键) → onCaptured`
  - 修饰键不退出
  - Escape ⇒ `onCancelled`
  - 同时 `start` 两次：第一个自动 cancel
  - unmount 清理 listener
- `src/components/shell/ShortcutBindingRow.spec.ts`
  - 渲染 effective / `未绑定` 文本
  - `capturing` 状态展示
  - 点击触发 emits

### 改造

- `src/platform/shortcuts/registry.spec.ts`
  - 新增 `rebuild()` 用例
- `src/composables/useEditorShortcuts.spec.ts`（若不存在则新建）
  - bindings 变化后旧键失效、新键生效
  - `paused = true` 时短路
  - `lyrics.mark` 与 `lyrics.mark2` 通过同一 handler
- `src/platform/settings/local-settings.spec.ts`
  - shortcutOverrides 字段往返
  - 损坏值时整体回落
- `src/composables/useLocalSettings.spec.ts`（若存在）
  - shortcutOverrides 持久化触发

## TDD 执行顺序（供 implementation plan 用，不在本 spec 内细化）

1. `defaults.ts` + spec
2. `overrides.ts` + spec
3. `capture.ts` + spec
4. `useShortcutBindings.ts` + spec
5. `useShortcutCapture.ts` + spec
6. `registry.ts` rebuild + spec 扩展
7. `useEditorShortcuts.ts` 改造 + spec
8. `local-settings.ts` 字段扩展 + spec
9. `useLocalSettings.ts` 集成 shortcutOverrides
10. `ShortcutBindingRow.vue` + spec
11. `PreferencesModal.vue` 改造
12. `AppShell.vue` 接线

## 范围之外

- 不增加跨平台修饰键别名（macOS `Cmd` 与 Win `Ctrl` 仍按 `normalizeKeystroke` 现行逻辑分别处理）
- 不实现快捷键搜索/过滤 UI（动作总数 19，列表足以）
- 不导出/导入快捷键覆盖 JSON（按 §0 决议，归 `LocalUserState`）
- 不为快捷键变更接入 command history（按主人确认：不走 undo/redo）
- 不增加多键序列（Chord，如 `Ctrl+K Ctrl+S`）—— 当前 `normalizeKeystroke` 仅支持单 keystroke，未来扩展再议
