# Grid Visibility And Empty New Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` for inline implementation after the user reviews this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent local grid visibility toggle, make new projects start without timing points, and harden timeline/timing UI for empty timing point arrays.

**Architecture:** Treat grid visibility as local user state, not project data. The store owns the persisted preference, `TransportBar` exposes the toggle, `useTimelineView` passes the setting into `GridOverlayPlugin`, and the grid plugin clears only beat/bar/subdivision lines while preserving pointer time preview behavior.

**Tech Stack:** Vue 3 Composition API, Pinia, Vitest, Vue Test Utils, happy-dom, WaveSurfer overlay plugins, zod local settings validation.

---

## Scope And File Map

**Modify:**
- `src/platform/settings/local-settings.ts`: add `gridVisible` to hidden `LocalUserState`.
- `src/platform/settings/local-settings.spec.ts`: cover default, save/load, and export omission for `gridVisible`.
- `src/stores/editor-store.ts`: add reactive `gridVisible`, `setGridVisible`, `applyLocalState`, and `exportLocalStateBase` wiring.
- `src/stores/editor-store.spec.ts`: update timing point assumptions and cover grid visibility state.
- `src/core/domain/project.ts`: make default `timingPoints` an empty array.
- `src/platform/waveform/grid-overlay-plugin.ts`: accept `visible`, clear/reset rendered range on hidden or empty timing points, preserve hover preview.
- `src/platform/waveform/grid-overlay-plugin.spec.ts`: cover hidden grid, preview preservation, and cache reset after empty/hidden state.
- `src/composables/useTimelineView.ts`: pass `store.gridVisible` to grid overlay and redraw when it changes.
- `src/composables/useTimelineView.spec.ts`: assert grid params include `visible` and update when toggled.
- `src/components/shell/TransportBar.vue`: add grid visibility icon button after snap toggle.
- `src/components/shell/TransportBar.spec.ts`: cover rendering, active state, click behavior, and timeline context mock shape.
- `src/components/shell/TimingPointList.vue`: show an empty timing point state when no timing points exist.
- `src/components/shell/TimingPointsPanel.spec.ts`: update setup helpers for no default point and cover empty state.
- `src/components/shell/TimingPointList.spec.ts`: update no-default assumptions and add empty list coverage if needed.
- `src/components/shell/AppShell.spec.ts`: update tests that assume a default timing point.
- `src/i18n/locales/zh-CN.json`: add transport tooltip/status text and timing empty-state text.

**Do not modify:**
- Project file schema version.
- Project save format beyond the existing `timingPoints` value naturally being `[]`.
- Hover time preview visibility.
- Snap behavior or grid math.

---

## Task 1: Local User State For Grid Visibility

**Files:**
- Modify: `src/platform/settings/local-settings.ts`
- Test: `src/platform/settings/local-settings.spec.ts`

- [ ] **Step 1: Write failing local settings tests**
  - Add a test that `DEFAULT_LOCAL_USER_STATE.gridVisible` is `true`.
  - Extend the save/load test to save `gridVisible: false` and assert it loads as `false`.
  - Extend the export omission test to assert exported visible settings do not include `gridVisible`.

- [ ] **Step 2: Run the targeted test and confirm failure**
  - Run: `pnpm test:run "src/platform/settings/local-settings.spec.ts"`
  - Expected: failure because `gridVisible` does not exist yet.

- [ ] **Step 3: Implement local state schema**
  - Add `gridVisible` to `localUserStateSchema` with default `true`.
  - Keep it out of `localUserSettingsSchema`.
  - Do not change `version`.

- [ ] **Step 4: Run targeted local settings tests**
  - Run: `pnpm test:run "src/platform/settings/local-settings.spec.ts"`
  - Expected: pass.

---

## Task 2: Store Preference Wiring

**Files:**
- Modify: `src/stores/editor-store.ts`
- Test: `src/stores/editor-store.spec.ts`

- [ ] **Step 1: Write failing store tests**
  - Add a test that `store.gridVisible` defaults to `true`.
  - Add a test that `store.setGridVisible(false)` updates the local preference, reports `status.settings.gridVisible`, does not dirty the project, and does not add undo history.
  - Extend local state application/export coverage so `applyLocalState({ gridVisible: false })` updates the store and `exportLocalStateBase()` includes `gridVisible`.

- [ ] **Step 2: Run the targeted store tests and confirm failure**
  - Run: `pnpm test:run "src/stores/editor-store.spec.ts"`
  - Expected: failure because the store has no `gridVisible` state or setter.

- [ ] **Step 3: Implement store state**
  - Add a shallow ref initialized from `DEFAULT_LOCAL_USER_STATE.gridVisible`.
  - Add a computed `gridVisible`.
  - Add `setGridVisible(enabled: boolean)` that updates the ref and emits `status.settings.gridVisible` with a localized `state` parameter matching the existing enabled/disabled status pattern.
  - Wire `applyLocalState()` and `exportLocalStateBase()`.
  - Return `gridVisible` and `setGridVisible` from the store.

- [ ] **Step 4: Add i18n status text**
  - Add `status.settings.gridVisible` to `src/i18n/locales/zh-CN.json`.
  - Use wording parallel to snap/auto-follow, for example “网格线已{state}”.

- [ ] **Step 5: Run targeted store tests**
  - Run: `pnpm test:run "src/stores/editor-store.spec.ts"`
  - Expected: pass after updating tests that assumed a default timing point in later tasks if this file now exposes those failures.

---

## Task 3: Empty Timing Point Project Defaults

**Files:**
- Modify: `src/core/domain/project.ts`
- Test: `src/stores/editor-store.spec.ts`
- Test: any existing core project/domain tests that assert default timing points.

- [ ] **Step 1: Write failing default project tests**
  - Update the existing “initializes with an empty project” test to assert `store.project.timingPoints` has length `0`.
  - Update the “creates a clean empty project” test to assert the new project has no timing points.
  - Update `activeTimingPointId` default coverage to expect `null`.

- [ ] **Step 2: Run the targeted store tests and confirm failure**
  - Run: `pnpm test:run "src/stores/editor-store.spec.ts"`
  - Expected: failure because the schema still creates `tp-1`.

- [ ] **Step 3: Change project defaults**
  - Change the `timingPoints` default in `projectDocumentSchema` to `[]`.
  - Keep validation/parse behavior otherwise unchanged.

- [ ] **Step 4: Update tests that need timing points**
  - For tests that exercise beat, bar, metronome, Tap BPM, or timing point mutation behavior, explicitly add a timing point inside the test setup.
  - Ensure tests no longer remove `store.project.timingPoints[0]` as a cleanup step for the default point.

- [ ] **Step 5: Run targeted store tests**
  - Run: `pnpm test:run "src/stores/editor-store.spec.ts"`
  - Expected: pass.

---

## Task 4: Grid Overlay Visibility And Cache Reset

**Files:**
- Modify: `src/platform/waveform/grid-overlay-plugin.ts`
- Test: `src/platform/waveform/grid-overlay-plugin.spec.ts`

- [ ] **Step 1: Write failing grid plugin tests**
  - Add a test that `plugin.update({ visible: false, ... })` removes grid SVG lines after lines have rendered.
  - Add a test that pointer preview still appears when `visible` is `false`.
  - Add a regression test for cache reset: render lines, update with empty timing points or `visible: false`, then update with timing points again and assert lines render without requiring scroll outside the old buffer.

- [ ] **Step 2: Run targeted grid plugin tests and confirm failure**
  - Run: `pnpm test:run "src/platform/waveform/grid-overlay-plugin.spec.ts"`
  - Expected: failure because `visible` is not accepted and cache reset is incomplete.

- [ ] **Step 3: Implement visibility handling**
  - Add `visible?: boolean` to grid params/options with effective default `true`.
  - At the start of `_draw()`, clear SVG children as today.
  - If hidden, duration invalid, visible range invalid, or timing points are empty, reset `renderedStart`, `renderedEnd`, and `hasRenderedRange` before returning.
  - Keep preview DOM and pointer handlers active regardless of grid visibility.

- [ ] **Step 4: Run targeted grid plugin tests**
  - Run: `pnpm test:run "src/platform/waveform/grid-overlay-plugin.spec.ts"`
  - Expected: pass.

---

## Task 5: Timeline Composable Passes Grid Visibility

**Files:**
- Modify: `src/composables/useTimelineView.ts`
- Test: `src/composables/useTimelineView.spec.ts`

- [ ] **Step 1: Write failing composable tests**
  - Add an assertion that initial grid update params include `visible: true`.
  - Add a test that `store.setGridVisible(false)` triggers a grid update with `visible: false`.
  - Ensure the current-time watcher still does not update grid overlay.

- [ ] **Step 2: Run targeted composable tests and confirm failure**
  - Run: `pnpm test:run "src/composables/useTimelineView.spec.ts"`
  - Expected: failure because grid params do not include `visible`.

- [ ] **Step 3: Wire grid visibility**
  - Add `visible: store.gridVisible` to `_buildOverlayParams()`.
  - Include `() => store.gridVisible` in the grid redraw watcher.
  - Do not include grid visibility in line overlay params.

- [ ] **Step 4: Run targeted composable tests**
  - Run: `pnpm test:run "src/composables/useTimelineView.spec.ts"`
  - Expected: pass.

---

## Task 6: TransportBar Grid Toggle

**Files:**
- Modify: `src/components/shell/TransportBar.vue`
- Test: `src/components/shell/TransportBar.spec.ts`
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Write failing TransportBar tests**
  - Add a test that the grid toggle renders when timeline context exists.
  - Add a test that the button is active when `store.gridVisible` is `true`.
  - Add a test that clicking it calls `store.setGridVisible(false)` behavior: state changes, status key is `status.settings.gridVisible`, project remains clean.
  - Add a test that the button is absent without timeline context if keeping it grouped with timeline controls.

- [ ] **Step 2: Run targeted TransportBar tests and confirm failure**
  - Run: `pnpm test:run "src/components/shell/TransportBar.spec.ts"`
  - Expected: failure because no grid toggle exists.

- [ ] **Step 3: Add UI control**
  - Add a square icon button after the snap toggle and before auto-follow.
  - Use active styling when `store.gridVisible` is true.
  - Use an icon that reads as grid/show-hide from the available Iconify set.
  - Add `transport.gridVisible` tooltip text in `zh-CN.json`.
  - Keep the button available only when timeline context exists, matching other timeline display controls.

- [ ] **Step 4: Run targeted TransportBar tests**
  - Run: `pnpm test:run "src/components/shell/TransportBar.spec.ts"`
  - Expected: pass.

---

## Task 7: Timing Panel Empty State

**Files:**
- Modify: `src/components/shell/TimingPointList.vue`
- Test: `src/components/shell/TimingPointsPanel.spec.ts`
- Test: `src/components/shell/TimingPointList.spec.ts`
- Modify: `src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Write failing empty-state tests**
  - Add a `TimingPointsPanel` test that a fresh store renders zero rows and shows an empty-state message.
  - Add a test that the add-at-current-time button still exists and can add the first timing point.
  - Update helpers that previously removed the default point so they now add test timing points directly.
  - Update `TimingPointList.spec.ts` tests that assume a default point.

- [ ] **Step 2: Run targeted timing panel tests and confirm failure**
  - Run: `pnpm test:run "src/components/shell/TimingPointsPanel.spec.ts" "src/components/shell/TimingPointList.spec.ts"`
  - Expected: failure from missing empty state and old default assumptions.

- [ ] **Step 3: Implement empty state**
  - In `TimingPointList.vue`, render a centered/lightweight empty message inside the list when `store.project.timingPoints.length === 0`.
  - Keep the existing list container click-to-clear behavior.
  - Keep clone disabled when no selected point exists.
  - Add `timing.pointList.empty` i18n text.

- [ ] **Step 4: Verify TimingPointsPanel null handling**
  - Confirm `activePoint`, `selectedPoint`, and `focusedPoint` remain `null` safely with no points.
  - Confirm controls do not call update actions when `focusedPoint` is null.
  - Confirm adding the first timing point uses fallback `120 BPM`, `4/4`.

- [ ] **Step 5: Run targeted timing panel tests**
  - Run: `pnpm test:run "src/components/shell/TimingPointsPanel.spec.ts" "src/components/shell/TimingPointList.spec.ts"`
  - Expected: pass.

---

## Task 8: Update AppShell And Cross-File Default Timing Assumptions

**Files:**
- Test: `src/components/shell/AppShell.spec.ts`
- Test: any test file failing from the no-default timing point change.

- [ ] **Step 1: Run focused shell tests**
  - Run: `pnpm test:run "src/components/shell/AppShell.spec.ts"`
  - Expected: likely failures where tests read `store.project.timingPoints[0]`.

- [ ] **Step 2: Update tests to create explicit timing points**
  - Replace default timing point access with explicit `store.addTimingPoint(...)`.
  - Preserve the behavior under test; do not reintroduce default project timing data in setup helpers.

- [ ] **Step 3: Search for remaining default timing point assumptions**
  - Use PowerShell `Select-String` because `rg.exe` is broken in this environment.
  - Search for patterns like `timingPoints[0]`, `tp-1`, and comments mentioning “default timing point”.
  - Update only tests and code paths whose assumptions are invalid after the new empty default.

- [ ] **Step 4: Run affected tests**
  - Run targeted tests for every modified spec file.
  - Expected: pass.

---

## Task 9: Integration Verification

**Files:**
- No new source files.
- May update docs/patterns only if implementation reveals a durable new rule.

- [ ] **Step 1: Run targeted suite**
  - Run: `pnpm test:run "src/platform/settings/local-settings.spec.ts" "src/stores/editor-store.spec.ts" "src/platform/waveform/grid-overlay-plugin.spec.ts" "src/composables/useTimelineView.spec.ts" "src/components/shell/TransportBar.spec.ts" "src/components/shell/TimingPointsPanel.spec.ts" "src/components/shell/TimingPointList.spec.ts" "src/components/shell/AppShell.spec.ts"`
  - Expected: pass.

- [ ] **Step 2: Run full test suite**
  - Run: `pnpm test:run`
  - Expected: pass.

- [ ] **Step 3: Run required project checks**
  - Run: `pnpm lint`
  - Expected: pass.
  - Run: `pnpm format`
  - Expected: pass and no unwanted formatting churn beyond touched files.
  - Run: `pnpm check`
  - Expected: pass because Vue/TypeScript types changed.

- [ ] **Step 4: Review diff**
  - Run: `git diff -- src/platform/settings/local-settings.ts src/platform/settings/local-settings.spec.ts src/stores/editor-store.ts src/stores/editor-store.spec.ts src/core/domain/project.ts src/platform/waveform/grid-overlay-plugin.ts src/platform/waveform/grid-overlay-plugin.spec.ts src/composables/useTimelineView.ts src/composables/useTimelineView.spec.ts src/components/shell/TransportBar.vue src/components/shell/TransportBar.spec.ts src/components/shell/TimingPointList.vue src/components/shell/TimingPointsPanel.spec.ts src/components/shell/TimingPointList.spec.ts src/components/shell/AppShell.spec.ts src/i18n/locales/zh-CN.json`
  - Check that project save format remains project-only, grid visibility stays local-only, and no unrelated refactors slipped in.

---

## Self-Review

- **Spec coverage:** The plan covers persistent local grid visibility, TransportBar toggle placement, hidden grid preserving hover preview, new projects without timing points, empty timing panel behavior, grid cache reset with empty timing points, and test/check requirements.
- **Placeholder scan:** No TBD/TODO placeholders. Each task identifies files, exact behavior, commands, and expected result.
- **Type consistency:** The plan consistently uses `gridVisible`, `setGridVisible`, `visible`, `LocalUserState`, and existing status/i18n patterns.
- **Scope check:** This is one cohesive feature touching timeline display preference plus the related empty timing point default. It does not include unrelated shortcut/list/help requests from the stepped spec.

