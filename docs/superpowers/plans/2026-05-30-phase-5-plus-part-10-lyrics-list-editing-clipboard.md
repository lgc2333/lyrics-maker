# Phase 5 Plus Part 10 Lyrics List Editing Clipboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository requires plans without embedded code snippets.

**Goal:** Add lyrics-mode clipboard paste, left-side lyrics list insert toolbar, command-backed line insertion/deletion, and status feedback while preserving undo/redo.

**Architecture:** Keep all project data mutations behind core command objects executed by the Pinia editor store. Keep clipboard reading and confirmation orchestration in `AppShell`, list editing intent in `useLyricsEditor`, and rendering in focused shell components.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Pinia, Vitest, Vue Test Utils, vue-i18n, Tailwind/DaisyUI, Iconify icons.

---

## Component Map

- `src/core/commands/lyrics-commands.ts`: add the position-aware insert-lines command.
- `src/core/commands/lyrics-commands.spec.ts`: cover insert-at behavior, clamping, undo, and invalid lines.
- `src/stores/editor-store.ts`: expose `insertLyricLinesAt`, route `insertLyricLines` through it, add status handling.
- `src/stores/editor-store.spec.ts`: cover store insert-at status, append compatibility, dirty/history behavior.
- `src/composables/useLyricsEditor.ts`: add empty-line insert helpers that activate the new line and request whole-line edit.
- `src/composables/useLyricsEditor.spec.ts`: cover top/above/below/bottom insert helpers, empty list behavior, and whole-line edit request.
- `src/platform/shortcuts/registry.ts`: register new shortcut actions.
- `src/platform/shortcuts/defaults.ts`: bind `lyrics.pasteClipboard` to `Ctrl+V`, leave above/below insert actions unbound.
- `src/i18n/status-label-maps.ts`: map new command/action ids to localized labels.
- `src/i18n/locales/zh-CN.json` and `src/i18n/locales/en-US.json`: add status, modal, toolbar, command, and action strings.
- `src/components/shell/LyricsClipboardConfirmModal.vue`: new presentational confirmation modal for clipboard paste preview.
- `src/components/shell/LyricsClipboardConfirmModal.spec.ts`: cover preview rendering and confirm/cancel emits.
- `src/components/shell/LyricsLineList.vue`: add left toolbar, row delete button, empty state, and related emits/calls.
- `src/components/shell/LyricsLineList.spec.ts`: cover toolbar buttons, disabled active-line buttons, empty state, delete click behavior, and edit activation.
- `src/components/shell/AppShell.vue`: filter effective shortcuts by mode, read clipboard, prepare pending paste, show modal, confirm/cancel paste.
- `src/components/shell/AppShell.spec.ts`: cover lyrics-mode paste, timing-mode non-interception, input-focus non-interception, confirmation insertion, and clipboard failures.
- `src/components/shell/StatusBar.spec.ts`: extend if needed to verify new label-map translations do not leak ids.
- `docs/patterns/vue-and-ui.md`: update only if implementation discovers a durable project rule worth preserving.

## Implementation Tasks

### Task 1: Core Insert-Lines-At Command

**Files:**
- Modify: `src/core/commands/lyrics-commands.spec.ts`
- Modify: `src/core/commands/lyrics-commands.ts`

- [ ] Add failing tests for `createInsertLyricLinesAtCommand` inserting multiple lines at a middle index.
- [ ] Add failing tests for negative index clamping to the top.
- [ ] Add failing tests for too-large index clamping to the bottom.
- [ ] Add failing tests for undo removing only the inserted line ids.
- [ ] Add failing tests for rejecting any inserted line with an empty `words` array.
- [ ] Run `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"` and confirm the new tests fail for missing command.
- [ ] Implement `createInsertLyricLinesAtCommand(insertIndex, lines)` in `lyrics-commands.ts`.
- [ ] Keep existing `createInsertLyricLinesCommand(lines)` available, either by delegating to the new command with append semantics or by preserving its current behavior.
- [ ] Run `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"` and confirm the command tests pass.

### Task 2: Store API And Status

**Files:**
- Modify: `src/stores/editor-store.spec.ts`
- Modify: `src/stores/editor-store.ts`
- Modify: `src/i18n/status-label-maps.ts`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en-US.json`

- [ ] Add failing store tests for `insertLyricLinesAt(index, lines)` inserting at the requested index, marking dirty, and setting a status with `count`.
- [ ] Add failing store tests proving `insertLyricLines(lines)` still appends to the end.
- [ ] Add failing store tests proving insert-at can be undone via `store.undo()`.
- [ ] Add failing label-map/i18n coverage if an existing status-label-map test exists; otherwise cover via `StatusBar.spec.ts` in Task 7.
- [ ] Run `pnpm test:run "src/stores/editor-store.spec.ts"` and confirm the new tests fail.
- [ ] Import the new command into `editor-store.ts`.
- [ ] Add `insertLyricLinesAt(index, lines)` and route `insertLyricLines(lines)` through append semantics.
- [ ] Add `lyrics.insertLinesAt` to `COMMAND_LABEL_KEYS`.
- [ ] Add localized command and status strings for insert-at and empty-line insertion.
- [ ] Run `pnpm test:run "src/stores/editor-store.spec.ts"` and confirm the store tests pass.

### Task 3: Lyrics Editor Empty-Line Helpers

**Files:**
- Modify: `src/composables/useLyricsEditor.spec.ts`
- Modify: `src/composables/useLyricsEditor.ts`

- [ ] Add failing composable tests for `insertEmptyLineTop()` inserting at index `0`, selecting the new line, and incrementing `wholeLineEditRequestId`.
- [ ] Add failing composable tests for `insertEmptyLineBottom()` inserting at the end, including when the lyrics list is empty.
- [ ] Add failing composable tests for `insertEmptyLineAboveActive()` inserting before the active line and no-oping with no active line.
- [ ] Add failing composable tests for `insertEmptyLineBelowActive()` inserting after the active line and no-oping with no active line.
- [ ] Run `pnpm test:run "src/composables/useLyricsEditor.spec.ts"` and confirm the new tests fail.
- [ ] Add the empty-line helper methods to `useLyricsEditor`.
- [ ] Use `createPrefixedId` for new line and word ids.
- [ ] After successful insertion, set `activeLineId`, reset `activeWordIndex`, switch/request whole-line edit through the existing edit request mechanism.
- [ ] Return the new helpers from `useLyricsEditor`.
- [ ] Run `pnpm test:run "src/composables/useLyricsEditor.spec.ts"` and confirm the composable tests pass.

### Task 4: Shortcut Action Registration

**Files:**
- Modify: `src/platform/shortcuts/registry.ts`
- Modify: `src/platform/shortcuts/defaults.ts`
- Modify: `src/i18n/status-label-maps.ts`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en-US.json`
- Modify: relevant shortcut/i18n tests if present, otherwise `src/components/shell/StatusBar.spec.ts`

- [ ] Add failing tests or type-driven assertions for the new actions: `lyrics.pasteClipboard`, `lyrics.insertLineAbove`, and `lyrics.insertLineBelow`.
- [ ] Add `lyrics.pasteClipboard` with default `Ctrl+V`.
- [ ] Add `lyrics.insertLineAbove` and `lyrics.insertLineBelow` with default `null`.
- [ ] Add action label map entries and localized action labels.
- [ ] Run shortcut/status tests that cover default bindings and label rendering.

### Task 5: Clipboard Confirmation Modal

**Files:**
- Create: `src/components/shell/LyricsClipboardConfirmModal.vue`
- Create: `src/components/shell/LyricsClipboardConfirmModal.spec.ts`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en-US.json`

- [ ] Add failing modal tests for rendering the insertion position text for selected-line-below.
- [ ] Add failing modal tests for rendering the insertion position text for list-bottom.
- [ ] Add failing modal tests for showing all preview lines in a scrollable list.
- [ ] Add failing modal tests for confirm and cancel emits.
- [ ] Run `pnpm test:run "src/components/shell/LyricsClipboardConfirmModal.spec.ts"` and confirm the tests fail.
- [ ] Implement the modal as a presentational component with props for preview lines and insertion position.
- [ ] Add localized modal title, body, confirm, cancel, and insertion-position strings.
- [ ] Run `pnpm test:run "src/components/shell/LyricsClipboardConfirmModal.spec.ts"` and confirm the modal tests pass.

### Task 6: Lyrics List Toolbar And Row Delete UI

**Files:**
- Modify: `src/components/shell/LyricsLineList.spec.ts`
- Modify: `src/components/shell/LyricsLineList.vue`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en-US.json`

- [ ] Add failing component tests for the left toolbar rendering four icon buttons with stable test ids.
- [ ] Add failing component tests that top and bottom toolbar buttons are enabled for an empty list and create/select/edit a first line.
- [ ] Add failing component tests that above/below toolbar buttons are disabled when no line is selected.
- [ ] Add failing component tests that above/below insert at the correct position when a line is selected.
- [ ] Add failing component tests for the row delete button deleting the target line without triggering row activation.
- [ ] Add failing component tests for the empty list state.
- [ ] Run `pnpm test:run "src/components/shell/LyricsLineList.spec.ts"` and confirm the new tests fail.
- [ ] Update `LyricsLineList.vue` to use a left toolbar plus list layout.
- [ ] Wire toolbar buttons to the `useLyricsEditor` helper methods.
- [ ] Add the row delete icon button and stop propagation on click.
- [ ] Add concise empty-state UI.
- [ ] Add localized toolbar tooltips/aria labels and empty-state text.
- [ ] Run `pnpm test:run "src/components/shell/LyricsLineList.spec.ts"` and confirm the list tests pass.

### Task 7: AppShell Clipboard Flow

**Files:**
- Modify: `src/components/shell/AppShell.spec.ts`
- Modify: `src/components/shell/AppShell.vue`
- Modify: `src/components/shell/StatusBar.spec.ts` if needed for status text coverage
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en-US.json`

- [ ] Add failing AppShell tests for lyrics-mode `Ctrl+V` reading `navigator.clipboard.readText()` and opening the confirmation modal.
- [ ] Add failing tests for timing-mode `Ctrl+V` not reading clipboard and not calling `preventDefault()`.
- [ ] Add failing tests for text-input focus allowing native paste behavior.
- [ ] Add failing tests for confirm inserting parsed non-empty lines below the active line.
- [ ] Add failing tests for confirm inserting at the bottom when no line is selected.
- [ ] Add failing tests for cancel closing the modal, not mutating lyrics, and showing paste-cancelled status.
- [ ] Add failing tests for unsupported Clipboard API, read rejection, empty clipboard text, and no non-empty parsed lines.
- [ ] Run `pnpm test:run "src/components/shell/AppShell.spec.ts"` and confirm the new tests fail.
- [ ] Add mode-filtered shortcut bindings so `lyrics.pasteClipboard` exists only while `editorMode === 'lyrics'`.
- [ ] Add clipboard read orchestration and pending paste state in `AppShell.vue`.
- [ ] Use existing `autoSplitText()` and `createPrefixedId()` to prepare `LyricLine[]` only after valid text exists.
- [ ] Render `LyricsClipboardConfirmModal` while pending paste exists.
- [ ] On confirm, compute insertion index from the current active line at confirmation time and call `store.insertLyricLinesAt()`.
- [ ] On cancel or clipboard errors, report specific `StatusBar` keys for paste cancelled, clipboard unsupported, clipboard read failed, clipboard empty, and no parsed lyric lines; avoid project mutation in all five paths.
- [ ] Run `pnpm test:run "src/components/shell/AppShell.spec.ts"` and confirm the AppShell tests pass.

### Task 8: Integration Verification And Cleanup

**Files:**
- Review all files touched in Tasks 1-7.
- Modify docs/patterns only if a reusable project rule emerged.

- [ ] Run targeted tests:
  - `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
  - `pnpm test:run "src/stores/editor-store.spec.ts"`
  - `pnpm test:run "src/composables/useLyricsEditor.spec.ts"`
  - `pnpm test:run "src/components/shell/LyricsClipboardConfirmModal.spec.ts"`
  - `pnpm test:run "src/components/shell/LyricsLineList.spec.ts"`
  - `pnpm test:run "src/components/shell/AppShell.spec.ts"`
- [ ] Run the full unit suite with `pnpm test:run`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm format`.
- [ ] Run `pnpm check`.
- [ ] Inspect `git diff` for accidental unrelated edits, leaked internal ids, and missing i18n.
- [ ] Commit implementation with a conventional commit message such as `feat: add lyrics list editing clipboard paste`.

## Self-Review Checklist

- [ ] Spec coverage: command-backed insert/delete, lyrics-only paste, preview confirmation, four-button toolbar, empty list behavior, direct whole-line edit, status failures, undo/redo.
- [ ] No placeholders: every task names exact files, tests, commands, and expected behavior.
- [ ] Type consistency: command label `lyrics.insertLinesAt`, action ids `lyrics.pasteClipboard`, `lyrics.insertLineAbove`, `lyrics.insertLineBelow`, and store/composable method names match across tasks.
- [ ] Scope control: no shortcut customization UI, no file-import changes, no timing model changes, no delete confirmation.
