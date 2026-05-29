# Phase 5 Plus Part 7 Post 2 Export Validation UI Polish Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This is a concise plan by user request and intentionally contains no code snippets.

**Goal:** Add export-time project validation with a warning modal, a File menu validation action, and small MenuBar/StatusBar/PreferencesModal polish.

**Architecture:** Keep validation in Vue-free core code. Let `AppShell` orchestrate export gating and manual validation, with `MenuBar` emitting intent and a focused modal rendering validation results.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Pinia store, Vitest, Vue Test Utils, Tailwind/DaisyUI.

---

## Component Map

- `src/core/domain/project-validation.ts`: pure project validation rules and issue metadata.
- `src/core/domain/project-validation.spec.ts`: validator behavior tests.
- `src/components/shell/ProjectValidationModal.vue`: presentational validation result modal.
- `src/components/shell/ProjectValidationModal.spec.ts`: modal rendering and emit tests.
- `src/components/shell/MenuBar.vue`: File menu action and light menu sizing polish.
- `src/components/shell/MenuBar.spec.ts`: validate menu emit coverage.
- `src/components/shell/AppShell.vue`: export gating and manual validation orchestration.
- `src/components/shell/AppShell.spec.ts`: export validation flow coverage.
- `src/components/shell/StatusBar.vue`: height/font polish.
- `src/components/shell/PreferencesModal.vue`: compact sidebar hover polish.
- `src/i18n/locales/zh-CN.json`: validation, menu, modal, and status strings.

## Tasks

- [ ] Add failing validator tests for duplicate ids, invalid numbers, timing points, line overlap, word overlap, placeholders, and target-specific missing timing warnings.
- [ ] Implement the pure validator until the new core tests pass.
- [ ] Add failing modal tests for issue grouping, export confirmation, cancel, and read-only close mode.
- [ ] Implement the validation modal until its tests pass.
- [ ] Add failing MenuBar test for the File menu `Validate Project` action.
- [ ] Wire the MenuBar emit and menu item until the test passes.
- [ ] Add failing AppShell tests for clean export, blocked export warning, continue export, cancel export, and manual validate feedback.
- [ ] Wire AppShell validation orchestration until the tests pass.
- [ ] Add i18n strings for menu, modal, issue messages, and statuses.
- [ ] Apply MenuBar, StatusBar, and PreferencesModal style polish.
- [ ] Run targeted tests for validator, modal, MenuBar, and AppShell.
- [ ] Run project verification: lint, format, check, and relevant tests.
