# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-1 infrastructure baseline (domain model, undo/redo core, i18n scaffold, shortcut registry, file persistence, and minimal UI shell) without implementing timing/audio features.

**Architecture:** Keep business logic in framework-agnostic `core/*` modules, expose state orchestration through a single Pinia setup store, and keep route/page components as thin composition surfaces. Every mutating action flows through typed commands so undo/redo is guaranteed for all phase-1 editable operations. Browser-specific behavior (shortcuts, file writing) lives in `platform/*` services/composables with explicit capability checks and user-visible errors.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Pinia, vue-router, vue-i18n, Vitest, Vue Test Utils, happy-dom, TypeScript, Vite, pnpm.

---

## File Structure Map

- `src/core/domain/project.ts` — phase-1 project types, default factory, serialization helpers.
- `src/core/commands/command.ts` — shared command interfaces.
- `src/core/commands/history.ts` — execute/undo/redo stack with redo-branch invalidation.
- `src/core/commands/project-commands.ts` — concrete project editing commands for phase-1 actions.
- `src/stores/editor-store.ts` — Pinia store that owns editor session state and dispatches commands.
- `src/platform/i18n/index.ts` — i18n instance bootstrap.
- `src/platform/i18n/locales/zh-CN.ts` — initial locale messages.
- `src/platform/shortcuts/keystroke.ts` — keyboard event normalization.
- `src/platform/shortcuts/registry.ts` — shortcut registration + conflict detection + event dispatcher.
- `src/platform/persistence/file-system-access.ts` — File System Access API adapter.
- `src/platform/persistence/project-file-service.ts` — save/load orchestration + dirty-state transitions.
- `src/composables/useEditorShortcuts.ts` — store-to-shortcut binding.
- `src/composables/useProjectPersistence.ts` — `Ctrl+S` save pipeline hookup.
- `src/components/shell/*.vue` — minimal layout shell components.
- `src/pages/index.vue` — route composition surface only.
- `src/main.ts` — plugin installation (Pinia + router + i18n).
- `vitest.config.ts`, `src/test/setup.ts` — test runtime config.
- `src/**/*.spec.ts` — unit/component tests for each module.
- `README.md` — phase-1 usage and browser support notes.

---

### Task 1: Testing Baseline + Domain Seed

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/core/domain/project.ts`
- Test: `src/core/domain/project.spec.ts`

- [ ] **Step 1: Add test dependencies and scripts**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.9",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^15.11.7"
  },
  "dependencies": {
    "vue-i18n": "^9.14.1"
  }
}
```

- [ ] **Step 2: Create Vitest config and setup file**

```ts
// vitest.config.ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
})
```

```ts
// src/test/setup.ts
import { afterEach } from 'vitest'
import { config } from '@vue/test-utils'

afterEach(() => {
  config.global.stubs = {}
})
```

- [ ] **Step 3: Write failing domain seed test**

```ts
// src/core/domain/project.spec.ts
import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './project'

describe('createEmptyProject', () => {
  it('returns phase-1 default project skeleton', () => {
    const project = createEmptyProject()
    expect(project.version).toBe(1)
    expect(project.settings.locale).toBe('zh-CN')
    expect(project.lyrics).toEqual([])
  })
})
```

- [ ] **Step 4: Run the test and verify it fails**

Run: `pnpm test:run src/core/domain/project.spec.ts`  
Expected: FAIL with module/function missing errors for `createEmptyProject`.

- [ ] **Step 5: Implement the minimal domain model factory**

```ts
// src/core/domain/project.ts
export type LocaleCode = 'zh-CN'

export interface ProjectSettings {
  locale: LocaleCode
  snapDivisor: 4 | 8 | 16
}

export interface LyricWord {
  id: string
  text: string
  startTime: number | null
  endTime: number | null
}

export interface LyricLine {
  id: string
  text: string
  words: LyricWord[]
}

export interface ProjectDocument {
  version: 1
  title: string
  settings: ProjectSettings
  lyrics: LyricLine[]
}

export function createEmptyProject(): ProjectDocument {
  return {
    version: 1,
    title: 'Untitled Project',
    settings: { locale: 'zh-CN', snapDivisor: 4 },
    lyrics: [],
  }
}
```

- [ ] **Step 6: Re-run tests and verify pass**

Run: `pnpm test:run src/core/domain/project.spec.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.ts src/test/setup.ts src/core/domain/project.ts src/core/domain/project.spec.ts
git commit -m "test: bootstrap vitest and seed project domain" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Command History Engine (Undo/Redo Core)

**Files:**
- Create: `src/core/commands/command.ts`
- Create: `src/core/commands/history.ts`
- Test: `src/core/commands/history.spec.ts`

- [ ] **Step 1: Write failing tests for execute/undo/redo behavior**

```ts
// src/core/commands/history.spec.ts
import { describe, expect, it } from 'vitest'
import { createCommandHistory } from './history'

describe('command history', () => {
  it('executes command and pushes undo frame', () => {
    const history = createCommandHistory({ count: 0 })
    history.execute({
      label: 'inc',
      do: state => ({ ...state, count: state.count + 1 }),
      undo: state => ({ ...state, count: state.count - 1 }),
    })
    expect(history.state.count).toBe(1)
    expect(history.canUndo).toBe(true)
  })

  it('clears redo stack after new execute', () => {
    const history = createCommandHistory({ count: 0 })
    history.execute({ label: 'inc', do: s => ({ ...s, count: s.count + 1 }), undo: s => ({ ...s, count: s.count - 1 }) })
    history.undo()
    history.execute({ label: 'inc2', do: s => ({ ...s, count: s.count + 2 }), undo: s => ({ ...s, count: s.count - 2 }) })
    expect(history.canRedo).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm test:run src/core/commands/history.spec.ts`  
Expected: FAIL (`createCommandHistory` not found).

- [ ] **Step 3: Implement command contracts and history engine**

```ts
// src/core/commands/command.ts
export interface Command<TState> {
  label: string
  do: (state: TState) => TState
  undo: (state: TState) => TState
}
```

```ts
// src/core/commands/history.ts
import type { Command } from './command'

export function createCommandHistory<TState>(initialState: TState) {
  let current = initialState
  const undoStack: Command<TState>[] = []
  const redoStack: Command<TState>[] = []

  function execute(command: Command<TState>) {
    current = command.do(current)
    undoStack.push(command)
    redoStack.length = 0
  }

  function undo() {
    const command = undoStack.pop()
    if (!command) return
    current = command.undo(current)
    redoStack.push(command)
  }

  function redo() {
    const command = redoStack.pop()
    if (!command) return
    current = command.do(current)
    undoStack.push(command)
  }

  return {
    get state() { return current },
    get canUndo() { return undoStack.length > 0 },
    get canRedo() { return redoStack.length > 0 },
    execute,
    undo,
    redo,
  }
}
```

- [ ] **Step 4: Re-run tests and verify pass**

Run: `pnpm test:run src/core/commands/history.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/commands/command.ts src/core/commands/history.ts src/core/commands/history.spec.ts
git commit -m "feat: add command history undo redo core" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Project Commands + Editor Store

**Files:**
- Create: `src/core/commands/project-commands.ts`
- Create: `src/stores/editor-store.ts`
- Test: `src/stores/editor-store.spec.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write failing store tests for phase-1 editable actions**

```ts
// src/stores/editor-store.spec.ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editor-store'

describe('editor store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('supports add line + undo + redo', () => {
    const store = useEditorStore()
    store.addLyricLine('hello world')
    expect(store.project.lyrics).toHaveLength(1)
    store.undo()
    expect(store.project.lyrics).toHaveLength(0)
    store.redo()
    expect(store.project.lyrics).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm test:run src/stores/editor-store.spec.ts`  
Expected: FAIL (`useEditorStore` missing).

- [ ] **Step 3: Implement command factories and Pinia store**

```ts
// src/core/commands/project-commands.ts
import type { Command } from './command'
import type { ProjectDocument } from '../domain/project'

export function createAddLyricLineCommand(payload: { id: string; text: string }): Command<ProjectDocument> {
  return {
    label: 'lyrics.addLine',
    do: state => ({ ...state, lyrics: [...state.lyrics, { id: payload.id, text: payload.text, words: [] }] }),
    undo: state => ({ ...state, lyrics: state.lyrics.filter(line => line.id !== payload.id) }),
  }
}
```

```ts
// src/stores/editor-store.ts
import { defineStore } from 'pinia'
import { createEmptyProject, type ProjectDocument } from '../core/domain/project'
import { createCommandHistory } from '../core/commands/history'
import { createAddLyricLineCommand } from '../core/commands/project-commands'

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export const useEditorStore = defineStore('editor', () => {
  const history = shallowRef(createCommandHistory<ProjectDocument>(createEmptyProject()))
  const dirty = shallowRef(false)

  const project = computed(() => history.value.state)
  const canUndo = computed(() => history.value.canUndo)
  const canRedo = computed(() => history.value.canRedo)

  function execute(command: Parameters<typeof history.value.execute>[0]) {
    history.value.execute(command)
    dirty.value = true
  }

  function addLyricLine(text: string) {
    execute(createAddLyricLineCommand({ id: makeId('line'), text }))
  }

  function undo() {
    history.value.undo()
    dirty.value = true
  }

  function redo() {
    history.value.redo()
    dirty.value = true
  }

  return { project, dirty, canUndo, canRedo, addLyricLine, undo, redo }
})
```

- [ ] **Step 4: Register Pinia store usage in app entry**

```ts
// src/main.ts
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import './style.css'

createApp(App).use(createPinia()).use(router).mount('#app')
```

- [ ] **Step 5: Re-run tests and verify pass**

Run: `pnpm test:run src/stores/editor-store.spec.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/commands/project-commands.ts src/stores/editor-store.ts src/stores/editor-store.spec.ts src/main.ts
git commit -m "feat: wire phase1 editor store with command dispatcher" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: i18n Scaffold (zh-CN Only, Extensible)

**Files:**
- Create: `src/platform/i18n/locales/zh-CN.ts`
- Create: `src/platform/i18n/index.ts`
- Test: `src/platform/i18n/index.spec.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write failing i18n setup test**

```ts
// src/platform/i18n/index.spec.ts
import { describe, expect, it } from 'vitest'
import { i18n } from './index'

describe('i18n', () => {
  it('loads zh-CN as default locale', () => {
    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(i18n.global.t('shell.menu.file')).toBe('文件')
  })
})
```

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm test:run src/platform/i18n/index.spec.ts`  
Expected: FAIL (`i18n` export missing).

- [ ] **Step 3: Implement locale messages and i18n instance**

```ts
// src/platform/i18n/locales/zh-CN.ts
export const zhCN = {
  shell: {
    menu: { file: '文件' },
    mode: { timing: '时轴模式', lyrics: '歌词模式' },
  },
  status: {
    dirty: '未保存更改',
    saved: '已保存',
  },
  errors: {
    unsupportedFsApi: '当前浏览器不支持实时写盘',
    saveFailed: '保存失败，请重试',
  },
}
```

```ts
// src/platform/i18n/index.ts
import { createI18n } from 'vue-i18n'
import { zhCN } from './locales/zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
  },
})
```

- [ ] **Step 4: Install i18n plugin in app bootstrapping**

```ts
// src/main.ts
import { i18n } from './platform/i18n'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .mount('#app')
```

- [ ] **Step 5: Re-run tests and verify pass**

Run: `pnpm test:run src/platform/i18n/index.spec.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/i18n/locales/zh-CN.ts src/platform/i18n/index.ts src/platform/i18n/index.spec.ts src/main.ts
git commit -m "feat: add extensible i18n scaffold with zh-CN locale" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Shortcut Registration Framework (No Rebinding UI)

**Files:**
- Create: `src/platform/shortcuts/keystroke.ts`
- Create: `src/platform/shortcuts/registry.ts`
- Create: `src/composables/useEditorShortcuts.ts`
- Test: `src/platform/shortcuts/registry.spec.ts`

- [ ] **Step 1: Write failing tests for shortcut conflict and dispatch**

```ts
// src/platform/shortcuts/registry.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { createShortcutRegistry } from './registry'

describe('shortcut registry', () => {
  it('rejects conflicting shortcuts', () => {
    const registry = createShortcutRegistry()
    registry.register('Ctrl+Z', 'history.undo')
    const conflict = registry.register('Ctrl+Z', 'history.redo')
    expect(conflict.ok).toBe(false)
  })

  it('dispatches registered action', () => {
    const onAction = vi.fn()
    const registry = createShortcutRegistry()
    registry.register('Ctrl+Y', 'history.redo')
    registry.dispatch('Ctrl+Y', onAction)
    expect(onAction).toHaveBeenCalledWith('history.redo')
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm test:run src/platform/shortcuts/registry.spec.ts`  
Expected: FAIL (`createShortcutRegistry` missing).

- [ ] **Step 3: Implement keystroke normalizer and registry**

```ts
// src/platform/shortcuts/registry.ts
export type ShortcutAction = 'history.undo' | 'history.redo'

export function createShortcutRegistry() {
  const bindings = new Map<string, ShortcutAction>()

  function register(keys: string, action: ShortcutAction) {
    if (bindings.has(keys))
      return { ok: false as const, reason: 'conflict' as const }
    bindings.set(keys, action)
    return { ok: true as const }
  }

  function dispatch(keys: string, handler: (action: ShortcutAction) => void) {
    const action = bindings.get(keys)
    if (action)
      handler(action)
  }

  return { register, dispatch, bindings }
}
```

```ts
// src/platform/shortcuts/keystroke.ts
export function normalizeKeystroke(event: KeyboardEvent) {
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  const ctrl = event.ctrlKey ? 'Ctrl+' : ''
  const shift = event.shiftKey ? 'Shift+' : ''
  const alt = event.altKey ? 'Alt+' : ''
  return `${ctrl}${shift}${alt}${key}`
}
```

```ts
// src/composables/useEditorShortcuts.ts
import { onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editor-store'
import { normalizeKeystroke } from '../platform/shortcuts/keystroke'
import { createShortcutRegistry } from '../platform/shortcuts/registry'

export function useEditorShortcuts() {
  const store = useEditorStore()
  const registry = createShortcutRegistry()

  registry.register('Ctrl+Z', 'history.undo')
  registry.register('Ctrl+Y', 'history.redo')

  function onKeydown(event: KeyboardEvent) {
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName ?? '')
    if (inInput) return

    const key = normalizeKeystroke(event)
    registry.dispatch(key, (action) => {
      if (action === 'history.undo') store.undo()
      if (action === 'history.redo') store.redo()
    })
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
```

- [ ] **Step 4: Re-run tests and verify pass**

Run: `pnpm test:run src/platform/shortcuts/registry.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/shortcuts/keystroke.ts src/platform/shortcuts/registry.ts src/composables/useEditorShortcuts.ts src/platform/shortcuts/registry.spec.ts
git commit -m "feat: add keyboard shortcut registry and dispatch layer" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: File Persistence + Ctrl+S Save Pipeline

**Files:**
- Create: `src/platform/persistence/file-system-access.ts`
- Create: `src/platform/persistence/project-file-service.ts`
- Create: `src/composables/useProjectPersistence.ts`
- Test: `src/platform/persistence/project-file-service.spec.ts`
- Modify: `src/stores/editor-store.ts`
- Modify: `src/platform/shortcuts/registry.ts`
- Modify: `src/composables/useEditorShortcuts.ts`

- [ ] **Step 1: Write failing tests for capability checks and save flow**

```ts
// src/platform/persistence/project-file-service.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { createProjectFileService } from './project-file-service'

describe('project file service', () => {
  it('returns unsupported when File System Access API is unavailable', async () => {
    const service = createProjectFileService({})
    const result = await service.saveAs('{"version":1}')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unsupported')
  })

  it('writes JSON via writable stream', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn(async () => ({ write, close }))
    const showSaveFilePicker = vi.fn(async () => ({ createWritable }))
    const service = createProjectFileService({ showSaveFilePicker })
    const result = await service.saveAs('{"version":1}')
    expect(result.ok).toBe(true)
    expect(write).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm test:run src/platform/persistence/project-file-service.spec.ts`  
Expected: FAIL (service not found).

- [ ] **Step 3: Implement File System Access adapter and project service**

```ts
// src/platform/persistence/file-system-access.ts
export interface WritableFileLike {
  write: (content: string) => Promise<void>
  close: () => Promise<void>
}

export interface SaveFileHandleLike {
  createWritable: () => Promise<WritableFileLike>
}

export interface SaveFilePickerApi {
  showSaveFilePicker?: (options?: unknown) => Promise<SaveFileHandleLike>
}

export function hasSaveFilePicker(api: SaveFilePickerApi) {
  return typeof api.showSaveFilePicker === 'function'
}
```

```ts
// src/platform/persistence/project-file-service.ts
import type { SaveFilePickerApi } from './file-system-access'
import { hasSaveFilePicker } from './file-system-access'

export interface SaveResult {
  ok: boolean
  reason?: 'unsupported' | 'failed'
  errorMessage?: string
}

export function createProjectFileService(api: SaveFilePickerApi) {
  async function saveAs(content: string): Promise<SaveResult> {
    if (!hasSaveFilePicker(api))
      return { ok: false, reason: 'unsupported' }

    try {
      const handle = await api.showSaveFilePicker({
        suggestedName: 'lyrics-project.json',
        types: [{ description: 'Lyrics Project', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return { ok: true }
    }
    catch (error) {
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
  }

  return { saveAs }
}
```

- [ ] **Step 4: Wire save command into editor store and Ctrl+S composable**

```ts
// src/stores/editor-store.ts (additions)
const lastError = shallowRef<string | null>(null)

async function saveProject(service: { saveAs: (content: string) => Promise<{ ok: boolean; reason?: string }> }) {
  const content = JSON.stringify(project.value, null, 2)
  const result = await service.saveAs(content)
  if (!result.ok) {
    lastError.value = result.reason === 'unsupported'
      ? 'errors.unsupportedFsApi'
      : 'errors.saveFailed'
    return
  }
  dirty.value = false
}
```

```ts
// src/composables/useProjectPersistence.ts
import { createProjectFileService } from '../platform/persistence/project-file-service'
import { useEditorStore } from '../stores/editor-store'

export function useProjectPersistence() {
  const store = useEditorStore()
  const service = createProjectFileService(window)

  return {
    saveByShortcut: async () => store.saveProject(service),
  }
}
```

```ts
// src/platform/shortcuts/registry.ts (extend action set)
export type ShortcutAction = 'project.save' | 'history.undo' | 'history.redo'
```

```ts
// src/composables/useEditorShortcuts.ts (inject save callback)
import { onMounted, onUnmounted } from 'vue'
import { normalizeKeystroke } from '../platform/shortcuts/keystroke'
import { createShortcutRegistry } from '../platform/shortcuts/registry'
import type { ShortcutAction } from '../platform/shortcuts/registry'

export function useEditorShortcuts(options: { onAction: (action: ShortcutAction) => void }) {
  const registry = createShortcutRegistry()

  registry.register('Ctrl+S', 'project.save')
  registry.register('Ctrl+Z', 'history.undo')
  registry.register('Ctrl+Y', 'history.redo')

  function onKeydown(event: KeyboardEvent) {
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName ?? '')
    if (inInput) return
    registry.dispatch(normalizeKeystroke(event), options.onAction)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
```

- [ ] **Step 5: Re-run tests and verify pass**

Run: `pnpm test:run src/platform/persistence/project-file-service.spec.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/persistence/file-system-access.ts src/platform/persistence/project-file-service.ts src/platform/persistence/project-file-service.spec.ts src/composables/useProjectPersistence.ts src/stores/editor-store.ts
git add src/platform/shortcuts/registry.ts src/composables/useEditorShortcuts.ts
git commit -m "feat: add file persistence service and ctrl+s save pipeline" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Minimal UI Shell + Store Wiring

**Files:**
- Create: `src/components/shell/AppShell.vue`
- Create: `src/components/shell/MenuBar.vue`
- Create: `src/components/shell/TransportBar.vue`
- Create: `src/components/shell/MainView.vue`
- Create: `src/components/shell/ModePanel.vue`
- Modify: `src/pages/index.vue`
- Test: `src/components/shell/AppShell.spec.ts`

- [ ] **Step 1: Write failing shell render test**

```ts
// src/components/shell/AppShell.spec.ts
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import AppShell from './AppShell.vue'

describe('AppShell', () => {
  it('renders phase-1 shell sections', () => {
    const wrapper = mount(AppShell, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.get('[data-testid="menu-bar"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="transport-bar"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mode-panel"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm test:run src/components/shell/AppShell.spec.ts`  
Expected: FAIL (`AppShell.vue` missing).

- [ ] **Step 3: Implement thin shell components with `<script setup lang="ts">`**

```vue
<!-- src/components/shell/AppShell.vue -->
<script setup lang="ts">
import MainView from './MainView.vue'
import MenuBar from './MenuBar.vue'
import ModePanel from './ModePanel.vue'
import TransportBar from './TransportBar.vue'
import { useEditorShortcuts } from '../../composables/useEditorShortcuts'
import { useProjectPersistence } from '../../composables/useProjectPersistence'
import { useEditorStore } from '../../stores/editor-store'

const store = useEditorStore()
const persistence = useProjectPersistence()

useEditorShortcuts({
  onAction: async (action) => {
    if (action === 'history.undo') store.undo()
    if (action === 'history.redo') store.redo()
    if (action === 'project.save') await persistence.saveByShortcut()
  },
})
</script>

<template>
  <div class="flex h-screen flex-col">
    <MenuBar data-testid="menu-bar" />
    <TransportBar data-testid="transport-bar" />
    <MainView />
    <ModePanel data-testid="mode-panel" />
  </div>
</template>
```

```vue
<!-- src/components/shell/ModePanel.vue -->
<script setup lang="ts">
const mode = shallowRef<'timing' | 'lyrics'>('timing')
</script>

<template>
  <section class="flex-1 border-t border-base-300 p-4">
    <h2 class="text-sm font-semibold">{{ mode === 'timing' ? '时轴模式（占位）' : '歌词模式（占位）' }}</h2>
    <p class="text-xs opacity-70">Phase 1 仅提供基础骨架，不包含时轴功能实现。</p>
  </section>
</template>
```

```vue
<!-- src/components/shell/MenuBar.vue -->
<script setup lang="ts"></script>

<template>
  <header class="navbar border-b border-base-300 px-3">
    <div class="text-sm font-semibold">歌词打轴软件</div>
    <div class="ml-auto text-xs opacity-70">Phase 1 Infrastructure</div>
  </header>
</template>
```

```vue
<!-- src/components/shell/TransportBar.vue -->
<script setup lang="ts"></script>

<template>
  <section class="flex items-center gap-2 border-b border-base-300 p-3">
    <button class="btn btn-sm">播放/暂停（占位）</button>
    <button class="btn btn-sm btn-outline">时轴模式</button>
    <button class="btn btn-sm btn-outline">歌词模式</button>
  </section>
</template>
```

```vue
<!-- src/components/shell/MainView.vue -->
<script setup lang="ts"></script>

<template>
  <section class="h-[250px] border-b border-base-300 bg-base-200/30 p-3 text-xs opacity-70">
    波形 / 频谱主视图占位（Phase 1 不实现时轴功能）
  </section>
</template>
```

- [ ] **Step 4: Compose shell in route page**

```vue
<!-- src/pages/index.vue -->
<script setup lang="ts">
import AppShell from '../components/shell/AppShell.vue'
</script>

<template>
  <AppShell />
</template>
```

- [ ] **Step 5: Re-run tests and verify pass**

Run: `pnpm test:run src/components/shell/AppShell.spec.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/AppShell.vue src/components/shell/MenuBar.vue src/components/shell/TransportBar.vue src/components/shell/MainView.vue src/components/shell/ModePanel.vue src/components/shell/AppShell.spec.ts src/pages/index.vue
git commit -m "feat: add phase1 minimal shell and route composition" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Final Verification, Documentation, and Integration Commit

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add README section for phase-1 capabilities and browser constraints**

```md
## Phase 1 (Infrastructure)

- Command-based undo/redo core for phase-1 actions
- zh-CN i18n scaffold (extensible)
- Shortcut registration framework (no rebinding UI yet)
- Ctrl+S save via File System Access API (Chrome/Edge preferred)
- Minimal app shell for next phases
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint`  
Expected: no error output, process exits with code 0.

- [ ] **Step 3: Run type-check**

Run: `pnpm check`  
Expected: exits with code 0.

- [ ] **Step 4: Run unit/component tests**

Run: `pnpm test:run`  
Expected: all test files PASS.

- [ ] **Step 5: Run production build**

Run: `pnpm build`  
Expected: build succeeds and outputs files under `dist/`.

- [ ] **Step 6: Final commit**

```bash
git add README.md src
git commit -m "feat: deliver phase1 infrastructure baseline" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Spec Coverage Check (Self-Review)

- **撤销/重做先行并覆盖阶段 1 全功能** → Task 2, Task 3, Task 6
- **多语言基础框架（首发 zh-CN）** → Task 4
- **快捷键体系（仅注册框架）** → Task 5
- **File System Access + Ctrl+S 写盘** → Task 6
- **可运行最小 UI 骨架** → Task 7
- **测试策略（核心单测 + 少量 UI 交互）** → Task 1, Task 2, Task 3, Task 5, Task 6, Task 7
- **阶段边界（不做时轴实际功能）** → Task 7 占位实现 + README 范围说明

