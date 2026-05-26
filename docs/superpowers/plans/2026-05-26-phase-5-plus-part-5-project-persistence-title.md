# Phase 5 Plus Part 5 Project Persistence And Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement project save/open/save-as, automatic file autosave, browser draft recovery, and inline project title editing.

**Architecture:** Keep browser file access in `platform/persistence`, project state mutations in Pinia, and UI wiring in `useProjectPersistence`, `AppShell`, and `MenuBar`. Project edits continue to flow through command history when they are user-editable, while project open/draft restore reset the session state directly.

**Tech Stack:** Vue 3 Composition API, Pinia setup store, Vitest, Vue Test Utils, File System Access API, LocalStorage.

---

### Task 1: Extend Browser File Access Service

**Files:**
- Modify: `src/platform/persistence/file-system-access.ts`
- Modify: `src/platform/persistence/file-system-access.spec.ts`
- Modify: `src/platform/persistence/project-file-service.ts`
- Modify: `src/platform/persistence/project-file-service.spec.ts`

- [ ] **Step 1: Write failing tests for open/save support**

Add tests that expect `hasOpenFilePicker()`, `openProject()`, `saveAs(content, title)`, `save(content)`, and `hasCachedHandle()` to exist and behave correctly.

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `pnpm test:run "src/platform/persistence/file-system-access.spec.ts" "src/platform/persistence/project-file-service.spec.ts"`

Expected: FAIL because the open picker API and new service methods do not exist.

- [ ] **Step 3: Implement minimal platform/service support**

Add `OpenFileHandleLike`, `OpenFilePickerApi`, `ProjectFilePickerApi`, `hasOpenFilePicker()`, and `getPlatformFilePickerApi()`. Extend `createProjectFileService()` with open project, save as with suggested title, cached handle management, and no-picker autosave save.

- [ ] **Step 4: Run targeted tests to verify GREEN**

Run: `pnpm test:run "src/platform/persistence/file-system-access.spec.ts" "src/platform/persistence/project-file-service.spec.ts"`

Expected: PASS.

### Task 2: Add Draft Persistence Adapter

**Files:**
- Create: `src/platform/persistence/project-draft-service.ts`
- Create: `src/platform/persistence/project-draft-service.spec.ts`

- [ ] **Step 1: Write failing tests for localStorage draft behavior**

Cover save, load, clear, malformed JSON handling, unavailable storage handling, and `ProjectDocument` shape validation.

- [ ] **Step 2: Run targeted test to verify RED**

Run: `pnpm test:run "src/platform/persistence/project-draft-service.spec.ts"`

Expected: FAIL because the file does not exist.

- [ ] **Step 3: Implement minimal draft service**

Implement a Vue-free adapter that stores a JSON string under one stable key, parses safely, validates the basic project shape, and returns structured results.

- [ ] **Step 4: Run targeted test to verify GREEN**

Run: `pnpm test:run "src/platform/persistence/project-draft-service.spec.ts"`

Expected: PASS.

### Task 3: Store Project Session And Title Mutations

**Files:**
- Modify: `src/core/commands/project-commands.ts`
- Modify: `src/core/commands/project-commands.spec.ts`
- Modify: `src/stores/editor-store.ts`
- Modify: `src/stores/editor-store.spec.ts`

- [ ] **Step 1: Write failing tests for title command and session loading**

Cover `createSetProjectTitleCommand()`, `store.setProjectTitle()`, `store.loadProject()`, dirty behavior for opened vs draft-restored projects, `saveProject()`, `saveProjectAs()`, and `autoSaveProject()`.

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `pnpm test:run "src/core/commands/project-commands.spec.ts" "src/stores/editor-store.spec.ts"`

Expected: FAIL because title/session/autosave APIs do not exist.

- [ ] **Step 3: Implement minimal store and command support**

Add the title command. Add store methods to reset history around a loaded project, mark restored drafts dirty, save normally, save as, and autosave without opening a picker.

- [ ] **Step 4: Run targeted tests to verify GREEN**

Run: `pnpm test:run "src/core/commands/project-commands.spec.ts" "src/stores/editor-store.spec.ts"`

Expected: PASS.

### Task 4: Wire Composable Autosave And Draft Recovery

**Files:**
- Modify: `src/composables/useProjectPersistence.ts`
- Modify: `src/composables/useProjectPersistence.spec.ts`

- [ ] **Step 1: Write failing tests for persistence orchestration**

Cover shortcut save, explicit save as, open project, startup draft restore, per-change draft save, one-minute autosave, and cleanup on unmount.

- [ ] **Step 2: Run targeted test to verify RED**

Run: `pnpm test:run "src/composables/useProjectPersistence.spec.ts"`

Expected: FAIL because composable methods and side effects do not exist.

- [ ] **Step 3: Implement composable wiring**

Create one project file service and one draft service, restore draft on mount, watch project changes to save drafts, run `setInterval` every 60 seconds for file autosave, and expose `saveByShortcut`, `saveAs`, and `openProject`.

- [ ] **Step 4: Run targeted test to verify GREEN**

Run: `pnpm test:run "src/composables/useProjectPersistence.spec.ts"`

Expected: PASS.

### Task 5: Add Menu Actions And Inline Title Editing

**Files:**
- Modify: `src/components/shell/MenuBar.vue`
- Modify: `src/components/shell/MenuBar.spec.ts`
- Modify: `src/components/shell/AppShell.vue`
- Modify: `src/components/shell/AppShell.spec.ts`
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Write failing component tests**

Cover enabled save/open/save-as menu actions, dirty `*title` display, inline title editing with Enter/blur, Escape cancellation, and AppShell wiring to persistence methods.

- [ ] **Step 2: Run targeted component tests to verify RED**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: FAIL because the UI is not wired yet.

- [ ] **Step 3: Implement minimal UI**

Make file menu project actions enabled, emit project persistence events, render `*工程名`, and turn the title into a focused input while editing.

- [ ] **Step 4: Run targeted component tests to verify GREEN**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: PASS.

### Task 6: Final Verification

**Files:**
- All modified Part 5 files.

- [ ] **Step 1: Run Part 5 targeted tests**

Run: `pnpm test:run "src/platform/persistence/file-system-access.spec.ts" "src/platform/persistence/project-file-service.spec.ts" "src/platform/persistence/project-draft-service.spec.ts" "src/core/commands/project-commands.spec.ts" "src/stores/editor-store.spec.ts" "src/composables/useProjectPersistence.spec.ts" "src/components/shell/MenuBar.spec.ts" "src/components/shell/AppShell.spec.ts"`

- [ ] **Step 2: Run full project checks**

Run: `pnpm test:run`

Run: `pnpm lint`

Run: `pnpm format`

Run: `pnpm check`

Expected: all commands exit 0.
