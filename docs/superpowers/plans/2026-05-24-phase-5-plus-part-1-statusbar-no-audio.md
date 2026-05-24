# Phase 5 Plus Part 1 StatusBar And No-Audio Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `StatusBar` feedback channel and make no-audio workflows explicit without blocking lyrics text editing.

**Architecture:** Store-owned status messages provide a single feedback source for store actions, composables, and shell components. `StatusBar.vue` renders the latest transient message plus persistent dirty/saved state. Audio-required actions guard at the store/composable entry points, so controls remain stable and no-op paths are visible.

**Tech Stack:** Vue 3 `<script setup>`, Pinia setup store, Vitest + Vue Test Utils, vue-i18n, WaveSurfer overlay plugin tests.

---

### Task 1: Status Message State And History Labels

**Files:**
- Modify: `src/core/commands/history.ts`
- Modify: `src/core/commands/history.spec.ts`
- Modify: `src/stores/editor-store.ts`
- Modify: `src/stores/editor-store.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests that verify the command history exposes next undo/redo labels, and the editor store reports:

```ts
expect(store.statusMessage).toEqual(null)
store.undo()
expect(store.statusMessage?.key).toBe('status.history.noUndo')
store.addLyricLine('hello')
store.undo()
expect(store.statusMessage?.key).toBe('status.history.undo')
expect(store.statusMessage?.params?.commandLabel).toBe('lyrics.addLine')
```

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm test:run "src/core/commands/history.spec.ts" "src/stores/editor-store.spec.ts"`

Expected: FAIL because `nextUndoLabel`, `nextRedoLabel`, and `statusMessage` do not exist yet.

- [ ] **Step 3: Implement minimal store/history support**

Expose `nextUndoLabel`, `nextRedoLabel`, `statusMessage`, `showStatus`, and `clearStatus`. Update `undo()`, `redo()`, `saveProject()`, command-backed store actions, and guarded audio operations to publish status keys.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm test:run "src/core/commands/history.spec.ts" "src/stores/editor-store.spec.ts"`

Expected: PASS.

### Task 2: StatusBar Component And Shell Wiring

**Files:**
- Create: `src/components/shell/StatusBar.vue`
- Create: `src/components/shell/StatusBar.spec.ts`
- Modify: `src/components/shell/AppShell.vue`
- Modify: `src/components/shell/AppShell.spec.ts`
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Write failing tests**

Add tests that verify `StatusBar` renders dirty/saved fallback state and resolves command labels:

```ts
store.addLyricLine('hello')
expect(wrapper.get('[data-testid="status-persistent"]').text()).toContain('未保存更改')
store.undo()
expect(wrapper.get('[data-testid="status-message"]').text()).toContain('已撤销')
```

Add shell tests that lyrics mode can be selected with no audio loaded and that paste/import actions produce status text.

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm test:run "src/components/shell/StatusBar.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: FAIL because `StatusBar.vue` is missing and lyrics mode is still audio-gated.

- [ ] **Step 3: Implement component and wiring**

Create a compact bottom bar that reads `useEditorStore()`, translates the latest `statusMessage`, and always shows dirty/saved state. Mount it at the bottom of `AppShell.vue`. Remove the lyrics-mode no-audio gate.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm test:run "src/components/shell/StatusBar.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: PASS.

### Task 3: No-Audio Guards In UI And Lyrics Composable

**Files:**
- Modify: `src/components/shell/TransportBar.vue`
- Modify: `src/components/shell/TransportBar.spec.ts`
- Modify: `src/components/shell/TimingPointsPanel.vue`
- Modify: `src/components/shell/TimingPointControls.vue`
- Modify: `src/components/shell/TimingPointControls.spec.ts`
- Modify: `src/composables/useLyricsEditor.ts`
- Modify: `src/composables/useLyricsEditor.spec.ts`
- Modify: `src/composables/useTimelineView.ts`
- Modify: `src/composables/useTimelineView.spec.ts`

- [ ] **Step 1: Write failing tests**

Cover no-audio play, progress seek, subdivision/bar seek, Tap BPM, D/Shift+D/Enter lyrics timing, and line/word interval playback. The key assertion is always:

```ts
expect(store.statusMessage?.key).toBe('status.audioRequired')
expect(store.project.lyrics[0].startTime).toBeUndefined()
```

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm test:run "src/components/shell/TransportBar.spec.ts" "src/components/shell/TimingPointControls.spec.ts" "src/composables/useLyricsEditor.spec.ts" "src/composables/useTimelineView.spec.ts"`

Expected: FAIL because current no-audio paths are silent.

- [ ] **Step 3: Implement guards**

Keep controls visible. Let store actions and composables detect missing audio via `store.hasAudio`, emit clear `status.audioRequired` or `status.tapBpm.noAudio` messages, and return before mutating timing data.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm test:run "src/components/shell/TransportBar.spec.ts" "src/components/shell/TimingPointControls.spec.ts" "src/composables/useLyricsEditor.spec.ts" "src/composables/useTimelineView.spec.ts"`

Expected: PASS.

### Task 4: Overlay Color And Localized Timing Labels

**Files:**
- Modify: `src/platform/waveform/line-overlay-plugin.ts`
- Modify: `src/platform/waveform/line-overlay-plugin.spec.ts`
- Modify: `src/components/shell/TimingPointControls.spec.ts`
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Write failing tests**

Test that word separator dashed lines use yellow stroke values and timing labels are no longer English:

```ts
expect(ctx.strokeStyle).toContain('255, 214')
expect(wrapper.text()).toContain('偏移')
expect(wrapper.text()).toContain('点击测 BPM')
```

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts" "src/components/shell/TimingPointControls.spec.ts"`

Expected: FAIL because current separator lines are white and zh-CN labels are English.

- [ ] **Step 3: Implement minimal fixes**

Change dashed separator stroke to yellow and update `zh-CN.json` timing labels.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm test:run "src/platform/waveform/line-overlay-plugin.spec.ts" "src/components/shell/TimingPointControls.spec.ts"`

Expected: PASS.

### Task 5: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run: `pnpm test:run "src/core/commands/history.spec.ts" "src/stores/editor-store.spec.ts" "src/components/shell/StatusBar.spec.ts" "src/components/shell/AppShell.spec.ts" "src/components/shell/TransportBar.spec.ts" "src/components/shell/TimingPointControls.spec.ts" "src/composables/useLyricsEditor.spec.ts" "src/composables/useTimelineView.spec.ts" "src/platform/waveform/line-overlay-plugin.spec.ts"`

- [ ] **Step 2: Run project checks**

Run: `pnpm lint`

Run: `pnpm format`

Run: `pnpm test:run`

Run: `pnpm build`

Expected: all commands exit 0.
