# Phase 5 Plus Part 7 Import Export Implementation Plan

> **For agentic workers:** implement task-by-task with TDD. This project requires writing or updating tests first, watching them fail, then implementing the smallest production change that makes them pass.

**Goal:** Add Vue-free TXT/LRC/TTML/ASS/SRT/VTT lyric import/export adapters, shared file recognition, and UI flows for import, export, drag/drop, opening projects, and creating new projects.

**Architecture:** Core owns format detection, parsing, normalized imported lyric drafts, and serialization. Platform persistence owns browser file picker/save/download mechanics. Store owns converting imported drafts to project lines with IDs and replacing lyrics as an undoable/dirty project edit. Vue components own menus, drag/drop, confirmation modals, hidden inputs, and status reporting.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Pinia, Vitest, Vue Test Utils, File System Access API with anchor-download fallback.

---

## Research Notes And Spec Clarifications

- The spec has now corrected AMLL to TTML. Implement TTML as a practical subset: `<p begin end>` lines and nested `<span begin end>` word timing, with TTML clock times and offset times. This aligns with W3C TTML timing attributes and with Apple Music-like timed lyric files that commonly use TTML structure.
- WebVTT detection should prefer the `WEBVTT` header when content disagrees with extension.
- SRT detection should look for cue blocks containing `HH:MM:SS,mmm --> HH:MM:SS,mmm`.
- ASS detection should look for `[Script Info]`, `[Events]`, and `Dialogue:` lines; import/export can target `Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`.
- TXT is the fallback only when the extension is `.txt` or no stronger content signature exists. Do not silently treat arbitrary unsupported text files as TXT if their extension is a known unsupported extension.
- Timing model limitation: line-level subtitle intervals map line start to `line.startTime` and the final word end to the subtitle end. Intermediate words from auto-split remain untimed unless the source has explicit word timing.

## File Structure

- Create `src/core/lyrics-io/types.ts`: shared Vue-free format IDs, import/export result types, imported line/word draft types, adapter interface, errors.
- Create `src/core/lyrics-io/time.ts`: parse/format helpers for LRC, SRT/VTT, ASS, and TTML time expressions.
- Create `src/core/lyrics-io/line-builder.ts`: helpers that convert line/word intervals into the project boundary model, including empty placeholder words for silent gaps.
- Create `src/core/lyrics-io/txt.ts`: TXT adapter.
- Create `src/core/lyrics-io/lrc.ts`: LRC adapter with line-level, angle word-time, and compatible square word-time support.
- Create `src/core/lyrics-io/ttml.ts`: TTML adapter.
- Create `src/core/lyrics-io/subtitles.ts`: ASS/SRT/VTT adapters and subtitle text cleanup.
- Create `src/core/lyrics-io/registry.ts`: adapter registry, content/extension detection, parse/export dispatch.
- Create tests beside each core module, especially `lrc.spec.ts`, `ttml.spec.ts`, `subtitles.spec.ts`, and `registry.spec.ts`.
- Modify `src/core/commands/lyrics-commands.ts`: add a replace-all-lyrics command.
- Modify `src/stores/editor-store.ts`: add `replaceLyricsFromImport`, `createNewProject`, and lyric export helpers.
- Modify `src/platform/persistence/project-file-service.ts`: add shared file classification for selected/dropped files, lyric open picker, lyric save/download, and project-file recognition from `File`.
- Modify `src/composables/useProjectPersistence.ts`: orchestrate open-any-file, lyric import detection, export, and status reporting.
- Create `src/components/shell/ImportConfirmModal.vue`: confirmation UI before replacing lyrics.
- Modify `src/components/shell/UnsavedChangesDialog.vue`: accept action-specific copy for open/new while preserving existing tests.
- Modify `src/components/shell/MenuBar.vue`: remove top-level Lyrics menu, enable New Project, add lyric import/export entries under File.
- Modify `src/components/shell/AppShell.vue`: wire new menu actions, hidden lyric file input, import confirmation modal, drag/drop, and shared dirty-confirm action.
- Modify `src/i18n/locales/zh-CN.json`: add menu, modal, format, and status strings.

## Component Map

- `MenuBar.vue`: present menu actions only; emits `newProject`, `importLyricsFile`, `exportLyricsFile`, and existing project/audio events.
- `AppShell.vue`: orchestration surface; owns pending import and pending dirty action state, but delegates parsing/export/opening to `useProjectPersistence`.
- `ImportConfirmModal.vue`: presentational modal; receives detected format/file name and emits confirm/cancel.
- `UnsavedChangesDialog.vue`: reusable dirty-confirm modal; receives mode/copy or target action and emits save/discard/cancel.
- `useProjectPersistence`: composable boundary for browser file workflows; it should not render UI and should expose explicit async actions/results.

## Task 1: Core Types, Time Helpers, And Registry Skeleton

- Write failing tests for time parsing/formatting across LRC, SRT/VTT, ASS, and TTML.
- Write failing tests for registry detection precedence: content signature beats misleading extension; project JSON is classified as project; unsupported known extensions are rejected.
- Implement shared types, time helpers, registry, and empty adapter registration without UI dependencies.
- Verify with targeted core tests.

## Task 2: TXT Adapter

- Write failing tests that TXT import creates untimed lyric drafts from non-empty lines using `autoSplitText`.
- Write failing tests that TXT export emits only visible lyric text, one line per lyric line.
- Implement TXT adapter.
- Verify targeted tests.

## Task 3: LRC Adapter

- Write failing tests for ordinary line-level LRC.
- Write failing tests for angle-bracket word LRC where each inline timestamp starts the following segment.
- Write failing tests for compatible square-bracket word LRC.
- Write failing tests for final segment fallback in priority order: next line start, audio duration, then segment start plus one second.
- Write failing tests proving word-timed segments are preserved and not auto-split again.
- Implement LRC parser/exporter. Default export should use angle-bracket word timing when word timing is complete; line-level export is allowed when only line timing exists.
- Verify targeted tests.

## Task 4: TTML Adapter

- Write failing tests for line-level `<p begin end>text</p>`.
- Write failing tests for nested word spans with explicit begin/end.
- Write failing tests that timing gaps insert empty placeholder words at line start, between words, and at line end.
- Write failing tests for TTML export with escaped text and explicit line/word timing.
- Implement TTML parser/exporter using browser-free DOMParser alternatives if needed; in core, prefer a small XML parsing approach based on available browser/test globals only if it stays Vue-free. If DOMParser is unavailable in Node/happy-dom tests, use a constrained parser for the TTML subset.
- Verify targeted tests.

## Task 5: ASS/SRT/VTT Adapters

- Write failing tests for SRT import/export cue timing and text cleanup.
- Write failing tests for VTT import/export with `WEBVTT` header and cue timing.
- Write failing tests for ASS import/export dialogue start/end/text and basic ASS override tag cleanup on import.
- Implement shared subtitle interval conversion: line start from cue/dialogue start; final word end from cue/dialogue end; auto-split visible text for words.
- Verify targeted tests.

## Task 6: Replace-All Lyrics Command And Store Integration

- Write failing command/store tests that replacing imported lyrics replaces all current lyrics, marks dirty, is undoable, and preserves project title/timing/audio/local settings.
- Write failing tests that imported draft IDs are generated in the store, not in core parser.
- Implement `createReplaceLyricsCommand` and store actions for applying imported drafts and creating a clean empty project.
- Verify store tests.

## Task 7: Platform Persistence And File Interaction Services

- Write failing tests for opening a lyric file through the picker and returning file text/name/detected format without mutating store.
- Write failing tests for saving exported lyric text with suggested project-title filename and format extension.
- Write failing tests for unsupported/cancelled/failed results.
- Implement lyric picker/save APIs in `project-file-service.ts` or adjacent persistence module, keeping project save behavior intact.
- Verify persistence tests.

## Task 8: Import Confirmation Modal

- Write failing component tests that modal shows file name, detected format, replacement warning, and preservation note.
- Write failing tests that confirm/cancel emit explicit events.
- Implement `ImportConfirmModal.vue`.
- Verify component tests.

## Task 9: Menu Reorganization

- Write failing `MenuBar` tests that top-level Lyrics menu no longer exists.
- Write failing tests that New Project is enabled and emits `newProject`.
- Write failing tests that File menu contains import lyrics and export lyrics entries and emits the right events.
- Update existing tests that previously opened the Lyrics menu for paste/add-line; if those actions are intentionally removed from top-level menus, assert the new expected absence.
- Implement menu changes and i18n keys.
- Verify `MenuBar` tests.

## Task 10: AppShell Import/Open/New/Drag-Drop Orchestration

- Write failing tests that selecting a lyric file opens the import confirmation modal and does not change project data before confirm.
- Write failing tests that confirming import replaces lyrics, marks dirty, keeps project identity/audio/settings, and reports success.
- Write failing tests that cancelling import, parse failure, or unsupported file leaves project unchanged and reports status.
- Write failing tests that dropped single project files enter the open project flow and dropped single lyric files enter the import flow.
- Write failing tests that multiple dropped files are rejected with a status message.
- Write failing tests that New Project uses dirty confirmation when dirty and creates a clean empty project when confirmed.
- Implement orchestration with a single pending dirty action for open/new.
- Verify `AppShell` tests.

## Task 11: Export UI Flow

- Write failing tests that File menu export action saves/downloads the selected default format and reports success.
- For the first UI version, use a simple format choice. If no separate chooser is built, default to LRC and expose adapter-level format options for future UI; the core registry still supports all formats.
- Write failing tests that export rejects missing required timing for formats that cannot degrade predictably.
- Implement export flow and status reporting.
- Verify targeted tests.

## Task 12: Full Verification And Documentation Check

- Run targeted tests for new core modules, store, persistence, MenuBar, AppShell, and modal.
- Run `pnpm test:run`.
- Run `pnpm lint`.
- Run `pnpm format`.
- Run `pnpm check`.
- Review that core and platform modules remain Vue-free and do not import i18n where new code can avoid it.
- Review the spec acceptance list against implemented tests and note any intentional UI simplification, especially the initial export format chooser.
