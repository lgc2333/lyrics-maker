# Phase 5 Plus Part 2 Timing And Menu UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up menu, timing, snap, and `WordSplitBar` timing-edit UI now that `StatusBar` exists.

**Architecture:** Keep project mutations in store commands, keep menu interaction local to `MenuBar`, and keep timing control state derived from the existing timeline/store contexts. `TransportBar` will expose snap/rhythm/subdivision controls backed by project settings. `WordSplitBar` will keep timing mode in one row by moving timestamp editing into each timing block.

**Tech Stack:** Vue 3 `<script setup>`, Pinia setup store, vue-i18n, DaisyUI/Tailwind utilities, Vitest + Vue Test Utils.

---

### Task 1: Snap Setting Command And Store Wiring

**Files:**
- Modify: `src/core/commands/project-commands.ts`
- Modify: `src/core/commands/project-commands.spec.ts`
- Modify: `src/stores/editor-store.ts`
- Modify: `src/stores/editor-store.spec.ts`
- Modify: `src/components/shell/StatusBar.vue`
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Write the failing tests**

Add tests for a command and store action:

```ts
const cmd = createSetSnapEnabledCommand(false)
const after = cmd.do(createEmptyProject())
expect(after.settings.snapEnabled).toBe(false)
expect(cmd.undo(after).settings.snapEnabled).toBe(true)

store.setSnapEnabled(false)
expect(store.project.settings.snapEnabled).toBe(false)
expect(store.statusMessage?.key).toBe('status.settings.snapEnabled')
store.undo()
expect(store.project.settings.snapEnabled).toBe(true)
```

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm test:run "src/core/commands/project-commands.spec.ts" "src/stores/editor-store.spec.ts"`

Expected: FAIL because `createSetSnapEnabledCommand` and `store.setSnapEnabled` do not exist.

- [ ] **Step 3: Implement minimal command/store support**

Add `createSetSnapEnabledCommand(enabled: boolean)` with label `settings.setSnapEnabled`, previous-value capture inside `do()`, and guarded undo. Import it in `editor-store.ts`, expose `setSnapEnabled(enabled: boolean)`, publish `status.settings.snapEnabled`, and add status label translations.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm test:run "src/core/commands/project-commands.spec.ts" "src/stores/editor-store.spec.ts"`

Expected: PASS.

### Task 2: Menu Reorganization, Undo/Redo, And Hover Switching

**Files:**
- Modify: `src/components/shell/MenuBar.vue`
- Modify: `src/components/shell/MenuBar.spec.ts`
- Modify: `src/components/shell/AppShell.vue`
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Write the failing tests**

Cover menu structure, enabled Undo/Redo, operation labels, and hover switching:

```ts
store.addLyricLine('hello')
await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')
const undo = wrapper.get('[data-testid="menu-undo"]')
expect(undo.text()).toContain('添加歌词行')
await undo.trigger('click')
expect(store.project.lyrics).toHaveLength(0)

await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
await wrapper.get('[data-testid="menu-trigger-help"]').trigger('mouseenter')
expect(wrapper.find('[data-testid="menu-popup-help"]').exists()).toBe(true)
```

Also assert file menu contains New Project, Open Project, Open Music, Save Project, Save As, Preferences; edit contains Undo/Redo; help contains About; future-only items are disabled.

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts"`

Expected: FAIL because undo/redo menu actions are disabled and hover switching is absent.

- [ ] **Step 3: Implement menu cleanup**

Use the existing local `openMenu` state. Add props for `canUndo`, `canRedo`, `nextUndoLabel`, and `nextRedoLabel`; emit `undo` and `redo`; close menus after actions. Remove the top-level View/Lyrics menus for this Part and keep lyrics paste/add entry points outside the reorganized product menus only if already needed by `AppShell` tests. Add `onMenuHover(name)` so hovering another top-level menu switches when any menu is open.

- [ ] **Step 4: Wire AppShell**

Pass store undo/redo availability and labels to `MenuBar`, and wire `@undo="store.undo"` / `@redo="store.redo"`.

- [ ] **Step 5: Run tests to verify green**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: PASS.

### Task 3: Transport Timing Controls

**Files:**
- Modify: `src/components/shell/TransportBar.vue`
- Modify: `src/components/shell/TransportBar.spec.ts`
- Modify: `src/stores/editor-store.spec.ts`
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Write the failing tests**

Cover snap toggle, rhythm three-state buttons, and subdivision stepper:

```ts
await wrapper.get('[data-testid="snap-toggle"]').trigger('click')
expect(store.project.settings.snapEnabled).toBe(false)

await wrapper.get('[data-testid="rhythm-mode-triplets"]').trigger('click')
expect(timeline.rhythmMode.value).toBe('triplets')
expect(wrapper.find('[data-testid="rhythm-mode-alt"]').classes()).toContain('btn-active')

await wrapper.get('[data-testid="subdivision-increase"]').trigger('click')
expect(timeline.divisor.value).toBe(8)
```

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm test:run "src/components/shell/TransportBar.spec.ts" "src/stores/editor-store.spec.ts"`

Expected: FAIL because snap is disabled and rhythm/subdivision controls are still selects.

- [ ] **Step 3: Implement controls**

Make snap toggle call `store.setSnapEnabled(!store.project.settings.snapEnabled)` and style active when enabled. Replace rhythm select with three compact buttons: common, triplets, Alt indicator. Replace subdivision select with decrement button, center value, increment button; clamp to `[1, 2, 4, 8, 16]`.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm test:run "src/components/shell/TransportBar.spec.ts" "src/stores/editor-store.spec.ts"`

Expected: PASS.

### Task 4: Timing Point Delete Icon

**Files:**
- Modify: `src/components/shell/TimingPointList.vue`
- Modify: `src/components/shell/TimingPointList.spec.ts`

- [ ] **Step 1: Write the failing test**

Assert the delete button has an icon and no visible delete text:

```ts
const deleteBtn = wrapper.get('[data-testid="remove-timing-point"]')
expect(deleteBtn.text()).toBe('')
expect(deleteBtn.find('[data-icon]').exists()).toBe(true)
```

- [ ] **Step 2: Run test to verify red**

Run: `pnpm test:run "src/components/shell/TimingPointList.spec.ts"`

Expected: FAIL because the button currently renders text.

- [ ] **Step 3: Implement icon button**

Import `Icon` from `@iconify/vue`, use a square ghost button with a trash icon, add `data-testid="remove-timing-point"`, and keep the title localized to the delete label.

- [ ] **Step 4: Run test to verify green**

Run: `pnpm test:run "src/components/shell/TimingPointList.spec.ts"`

Expected: PASS.

### Task 5: Lyrics Enter Reset And WordSplitBar Timing Layout

**Files:**
- Modify: `src/composables/useLyricsEditor.ts`
- Modify: `src/composables/useLyricsEditor.spec.ts`
- Modify: `src/components/shell/WordSplitBar.vue`
- Modify: `src/components/shell/WordSplitBar.spec.ts`

- [ ] **Step 1: Write the failing tests**

For Enter behavior:

```ts
editor.activeLineId.value = 'l1'
editor.activeWordIndex.value = 2
editor.handleNextLineKey(3)
await nextTick()
expect(editor.activeLineId.value).toBe('l2')
expect(editor.activeWordIndex.value).toBe(0)
```

For `WordSplitBar` timing layout:

```ts
expect(wrapper.find('[data-testid="numeric-editor"]').exists()).toBe(false)
expect(wrapper.find('[data-testid="start-time-input"]').exists()).toBe(true)
expect(wrapper.findAll('[data-testid="word-end-time-input"]')).toHaveLength(2)
await wrapper.get('[data-testid="start-time-input"]').setValue('1.250')
await wrapper.get('[data-testid="start-time-input"]').trigger('keydown.enter')
expect(store.project.lyrics[0].startTime).toBe(1.25)
```

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" "src/components/shell/WordSplitBar.spec.ts"`

Expected: FAIL because the active word can be re-derived from timed data and the timing editor is still a second row.

- [ ] **Step 3: Fix Enter reset**

After advancing `activeLineId` to the next line, set a one-tick watch suppression flag and `activeWordIndex.value = 0` so the next line always starts at the start block.

- [ ] **Step 4: Implement single-row timing inputs**

Keep the mode toggle and blocks in one row. In timing mode, render the start block and each word block as a stable inline grid/flex item with a right-side timestamp input. Start input applies `store.setLineStartTime` on Enter/change. Word inputs show the derived start timestamp plus `~` and apply `store.setWordEndTime` on Enter/change. Remove the second-row `numeric-editor`.

- [ ] **Step 5: Run tests to verify green**

Run: `pnpm test:run "src/composables/useLyricsEditor.spec.ts" "src/components/shell/WordSplitBar.spec.ts"`

Expected: PASS.

### Task 6: Focused And Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run: `pnpm test:run "src/core/commands/project-commands.spec.ts" "src/stores/editor-store.spec.ts" "src/components/shell/MenuBar.spec.ts" "src/components/shell/AppShell.spec.ts" "src/components/shell/TransportBar.spec.ts" "src/components/shell/TimingPointList.spec.ts" "src/composables/useLyricsEditor.spec.ts" "src/components/shell/WordSplitBar.spec.ts"`

Expected: PASS.

- [ ] **Step 2: Run project checks**

Run: `pnpm lint`

Run: `pnpm format`

Run: `pnpm test:run`

Run: `pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-05-24-phase-5-plus-part-2-timing-menu-ui.md src
git commit -m "feat: implement phase 5 plus part 2"
```
