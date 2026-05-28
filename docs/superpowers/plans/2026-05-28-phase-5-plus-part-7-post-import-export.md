# Phase 5 Plus Part 7 Post Import Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Part 7 post requirements for nested lyric export menus, visible LRC subtypes, LRC ending-boundary handling, and timing-loss warnings.

**Architecture:** Core keeps real parser/exporter adapters keyed by physical lyric format, while adding UI-facing import display formats and export targets for LRC variants. Platform and composable layers pass detected display format and export targets without parsing in UI. Vue components render localized names, nested menu behavior, and confirmation copy only.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Pinia, Vitest, Vue Test Utils, File System Access API abstractions, pnpm.

---

## File Structure

- Modify `src/core/lyrics-io/types.ts`: add LRC flavor, display format, and export target types; extend import detection results and export options.
- Modify `src/core/lyrics-io/registry.ts`: detect LRC subtypes and return display format metadata while preserving adapter lookup by physical format.
- Modify `src/core/lyrics-io/lrc.ts`: parse explicit trailing LRC end markers, apply empty timestamp lines as previous-line end boundaries, and export LRC variants with correct end-boundary syntax.
- Modify `src/core/lyrics-io/lrc.spec.ts`: cover LRC flavor behavior, empty-line boundary behavior, and variant exports.
- Modify `src/core/lyrics-io/registry.spec.ts`: cover LRC display format detection and non-misclassification of repeated ordinary LRC time tags.
- Modify `src/platform/persistence/project-file-service.ts`: carry `displayFormat` and LRC flavor through opened/dropped lyric files; save export targets with the physical file extension.
- Modify `src/platform/persistence/project-file-service.spec.ts`: cover display format propagation and `.lrc` suggested names for all LRC export targets.
- Modify `src/composables/useProjectPersistence.ts`: accept export target ids, map them to physical adapter format and export options, and keep import confirmation metadata.
- Modify `src/composables/useProjectPersistence.spec.ts`: cover export-target mapping and pending import display format.
- Modify `src/components/shell/ImportConfirmModal.vue`: show localized display format rather than only physical format.
- Modify `src/components/shell/ImportConfirmModal.spec.ts`: cover ordinary LRC, enhanced LRC, and ESLyric labels.
- Modify `src/components/shell/MenuBar.vue`: replace flat export items with a hover-open export submenu, localized labels, and timing-loss warnings.
- Modify `src/components/shell/MenuBar.spec.ts`: cover submenu open/close behavior, emitted export target ids, and warning text.
- Modify `src/components/shell/AppShell.vue`: pass export targets and pending import display format through existing orchestration.
- Modify `src/components/shell/AppShell.spec.ts`: adjust assertions for pending import metadata and export target forwarding if existing tests depend on old events.
- Modify `src/i18n/locales/zh-CN.json`: add export target names, timing-loss warnings, and LRC subtype import labels.
- Review `docs/patterns/vue-and-ui.md` only if menu behavior reveals a reusable menu pattern worth documenting; do not update docs unless a durable rule is learned.

## Task 1: Core Types And Detection Metadata

**Files:**
- Modify: `src/core/lyrics-io/types.ts`
- Modify: `src/core/lyrics-io/registry.ts`
- Test: `src/core/lyrics-io/registry.spec.ts`

- [ ] **Step 1: Write failing registry tests**

Add tests that prove:

- Enhanced LRC content is detected as physical format `lrc` and display format `lrc-enhanced`.
- ESLyric content is detected as physical format `lrc` and display format `lrc-eslyric`.
- Ordinary line LRC is detected as physical format `lrc` and display format `lrc-line`.
- Ordinary repeated time-tag LRC remains `lrc-line`, not `lrc-eslyric`.
- Non-LRC formats keep display format equal to their physical format.

- [ ] **Step 2: Run registry tests and confirm failure**

Run: `pnpm test:run "src/core/lyrics-io/registry.spec.ts"`

Expected: tests fail because display format and LRC flavor metadata do not exist yet.

- [ ] **Step 3: Add shared types**

Update `types.ts` with:

- `LrcFlavor`
- `LyricsDisplayFormatId`
- `LyricsExportTargetId`
- `LyricsExportTarget`
- display format metadata on lyric detection results
- LRC flavor or export target mapping fields where needed by later tasks

Keep `LyricsFormatId` unchanged as the physical adapter id.

- [ ] **Step 4: Implement LRC flavor detection**

Update `registry.ts` so `detectLyricsFileKind()` returns:

- `format: 'lrc'`
- `displayFormat: 'lrc-line' | 'lrc-enhanced' | 'lrc-eslyric'`
- `lrcFlavor: 'line' | 'enhanced' | 'eslyric'`

Use content signatures before extension fallback. Treat repeated ordinary LRC time tags at the beginning of a line as ordinary line LRC.

- [ ] **Step 5: Run registry tests and confirm pass**

Run: `pnpm test:run "src/core/lyrics-io/registry.spec.ts"`

Expected: all registry tests pass.

## Task 2: LRC Import Boundaries

**Files:**
- Modify: `src/core/lyrics-io/lrc.ts`
- Test: `src/core/lyrics-io/lrc.spec.ts`

- [ ] **Step 1: Write failing LRC import tests**

Add tests for:

- Ordinary LRC empty timestamp line applies to the previous non-empty line as final word `endTime`.
- Ordinary LRC empty timestamp line is ignored when there is no previous eligible line.
- Enhanced LRC trailing angle timestamp applies as the previous segment end and does not create an empty word.
- ESLyric trailing square timestamp applies as the previous segment end and does not create an empty word.
- Enhanced LRC without trailing end marker uses the next empty timestamp line as final word `endTime`.
- ESLyric without trailing end marker uses the next empty timestamp line as final word `endTime`.
- Existing fallback order remains intact when there is no explicit trailing marker and no usable empty timestamp line.

- [ ] **Step 2: Run LRC tests and confirm failure**

Run: `pnpm test:run "src/core/lyrics-io/lrc.spec.ts"`

Expected: tests fail because the current parser either treats trailing markers as empty segments or ignores empty timestamp line boundaries.

- [ ] **Step 3: Refactor LRC parse into entries**

In `lrc.ts`, parse raw lines into an intermediate representation that distinguishes:

- lyric lines with line start, body, inline timed segments, and subtype cues
- boundary-only empty timestamp lines

Keep this representation local to `lrc.ts`.

- [ ] **Step 4: Apply explicit line-end boundaries**

When building imported lines:

- Use a trailing inline timestamp with no following text as explicit line end.
- Use a following boundary-only timestamp as explicit line end if the previous line does not already have one.
- Ignore boundary-only lines that cannot be applied.
- Preserve existing fallback order after explicit boundaries.

- [ ] **Step 5: Run LRC tests and confirm pass**

Run: `pnpm test:run "src/core/lyrics-io/lrc.spec.ts"`

Expected: all LRC import tests pass.

## Task 3: LRC Export Targets

**Files:**
- Modify: `src/core/lyrics-io/types.ts`
- Modify: `src/core/lyrics-io/lrc.ts`
- Test: `src/core/lyrics-io/lrc.spec.ts`

- [ ] **Step 1: Write failing LRC export tests**

Add tests for:

- `lrcWordTiming: 'line'` exports an empty timestamp line after each lyric line when a final line end exists.
- `lrcWordTiming: 'angle'` exports enhanced LRC with a trailing angle timestamp for the line end.
- `lrcWordTiming: 'square'` exports ESLyric with a trailing square timestamp for the line end.
- LRC export skips or degrades incomplete timing according to the existing adapter behavior, without claiming word timing when not all word end times exist.

- [ ] **Step 2: Run LRC tests and confirm failure**

Run: `pnpm test:run "src/core/lyrics-io/lrc.spec.ts"`

Expected: tests fail because line export has no empty end marker and word-timed exports have no trailing end marker.

- [ ] **Step 3: Implement LRC variant export endings**

Update `lrc.ts` export behavior:

- Ordinary line LRC outputs line start and text, then an empty timestamp line when a final line end is known and differs from the line start.
- Enhanced LRC outputs inline angle timestamps for each word start plus a trailing angle timestamp for the final line end.
- ESLyric outputs inline square timestamps for each word start plus a trailing square timestamp for the final line end.

- [ ] **Step 4: Run LRC tests and confirm pass**

Run: `pnpm test:run "src/core/lyrics-io/lrc.spec.ts"`

Expected: all LRC tests pass.

## Task 4: Persistence And Composable Export Target Mapping

**Files:**
- Modify: `src/platform/persistence/project-file-service.ts`
- Modify: `src/composables/useProjectPersistence.ts`
- Test: `src/platform/persistence/project-file-service.spec.ts`
- Test: `src/composables/useProjectPersistence.spec.ts`

- [ ] **Step 1: Write failing persistence tests**

Add tests that prove:

- `readAnyFile()` returns `displayFormat` for LRC subtype imports.
- `openLyricsFile()` returns `displayFormat` for LRC subtype imports.
- Saving `lrc-line`, `lrc-enhanced`, and `lrc-eslyric` all suggests a `.lrc` file name.

- [ ] **Step 2: Write failing composable tests**

Add tests that prove:

- Pending lyric import includes `displayFormat`.
- Confirming import still uses the physical adapter format.
- Exporting `lrc-line` calls the LRC adapter with line options.
- Exporting `lrc-enhanced` calls the LRC adapter with angle options.
- Exporting `lrc-eslyric` calls the LRC adapter with square options.
- Non-LRC export targets keep their physical formats.

- [ ] **Step 3: Run targeted tests and confirm failure**

Run: `pnpm test:run "src/platform/persistence/project-file-service.spec.ts" "src/composables/useProjectPersistence.spec.ts"`

Expected: tests fail because only physical format is carried today.

- [ ] **Step 4: Implement target mapping in platform/composable layers**

Update persistence and composable code so:

- file reads return both physical format and display format
- `saveLyrics()` accepts an export target or enough metadata to derive the physical extension
- `exportLyrics()` accepts `LyricsExportTargetId`, maps it to physical adapter id and options, then saves using the physical extension

- [ ] **Step 5: Run targeted tests and confirm pass**

Run: `pnpm test:run "src/platform/persistence/project-file-service.spec.ts" "src/composables/useProjectPersistence.spec.ts"`

Expected: all targeted tests pass.

## Task 5: Import Confirmation Display Labels

**Files:**
- Modify: `src/components/shell/ImportConfirmModal.vue`
- Modify: `src/components/shell/AppShell.vue`
- Modify: `src/i18n/locales/zh-CN.json`
- Test: `src/components/shell/ImportConfirmModal.spec.ts`
- Test: `src/components/shell/AppShell.spec.ts`

- [ ] **Step 1: Write failing modal tests**

Add tests that mount the modal with display formats:

- `lrc-line` shows ordinary line LRC copy.
- `lrc-enhanced` shows enhanced LRC copy.
- `lrc-eslyric` shows ESLyric copy.
- Existing non-LRC formats still show their localized names.

- [ ] **Step 2: Write failing AppShell metadata test if needed**

If AppShell tests currently assert pending import format only, add or update a test that dropped or selected LRC content passes `displayFormat` into `ImportConfirmModal`.

- [ ] **Step 3: Run targeted tests and confirm failure**

Run: `pnpm test:run "src/components/shell/ImportConfirmModal.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: tests fail because the modal only receives physical format.

- [ ] **Step 4: Implement display format props and i18n labels**

Update modal and AppShell orchestration so:

- pending import state stores `displayFormat`
- modal accepts display format for label lookup
- zh-CN includes labels for ordinary LRC, enhanced LRC, ESLyric, and existing formats

- [ ] **Step 5: Run targeted tests and confirm pass**

Run: `pnpm test:run "src/components/shell/ImportConfirmModal.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: all targeted tests pass.

## Task 6: Nested Export Menu UI

**Files:**
- Modify: `src/components/shell/MenuBar.vue`
- Modify: `src/components/shell/AppShell.vue`
- Modify: `src/i18n/locales/zh-CN.json`
- Test: `src/components/shell/MenuBar.spec.ts`
- Test: `src/components/shell/AppShell.spec.ts`

- [ ] **Step 1: Write failing MenuBar tests**

Add or update tests that prove:

- File menu has one export parent menu item instead of flat export items.
- Hovering the export parent opens the export submenu.
- Hovering another file menu item closes the export submenu.
- Clicking outside closes the export submenu.
- Clicking each export submenu item emits the correct `LyricsExportTargetId`.
- TXT warning says it loses all timeline information.
- Ordinary LRC, SRT, and VTT warnings say they lose word-level timeline information.
- Enhanced LRC, ESLyric, TTML, and ASS do not show the lossy warning unless later requirements add one.

- [ ] **Step 2: Write failing AppShell forwarding test if needed**

Update AppShell tests so `@exportLyricsFile` forwarding uses export target ids rather than physical format ids.

- [ ] **Step 3: Run targeted tests and confirm failure**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: tests fail because export items are currently flat and emit physical formats.

- [ ] **Step 4: Implement nested menu state**

Update MenuBar with:

- a local submenu open state for file menu export
- hover handlers that open the export submenu and close it on other file menu item hovers
- outside-click closure for both top-level and nested menus
- export target list with localized labels and optional warning labels
- event typing that emits `LyricsExportTargetId`

Keep the existing top-level hover switching behavior.

- [ ] **Step 5: Run targeted tests and confirm pass**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts" "src/components/shell/AppShell.spec.ts"`

Expected: all targeted tests pass.

## Task 7: Integration Verification

**Files:**
- Review: all files modified above
- Optional docs: `docs/patterns/vue-and-ui.md` only if a durable menu rule is discovered

- [ ] **Step 1: Run all lyrics-io tests**

Run: `pnpm test:run "src/core/lyrics-io"`

Expected: all lyrics-io tests pass.

- [ ] **Step 2: Run all affected UI/composable/persistence tests**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts" "src/components/shell/ImportConfirmModal.spec.ts" "src/components/shell/AppShell.spec.ts" "src/composables/useProjectPersistence.spec.ts" "src/platform/persistence/project-file-service.spec.ts"`

Expected: all affected tests pass.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test:run`

Expected: all tests pass.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`

Expected: no lint errors.

- [ ] **Step 5: Run format**

Run: `pnpm format`

Expected: formatting completes without errors.

- [ ] **Step 6: Run type check**

Run: `pnpm check`

Expected: no TypeScript or Vue type errors.

- [ ] **Step 7: Review boundaries**

Confirm:

- `core/lyrics-io` does not import Vue, Pinia, browser picker APIs, or i18n.
- UI does not parse LRC content directly.
- Three visible LRC export targets still save with `.lrc`.
- Import confirmation copy uses display format metadata from core detection.

