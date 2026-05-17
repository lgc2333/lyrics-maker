# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start Vite dev server
pnpm build            # Type check (vue-tsc -b) + production build (vite build)
pnpm preview          # Preview built output
pnpm test:run         # Run all Vitest tests (headless)
pnpm test             # Run tests in watch mode
pnpm test:run "<path>"  # Run a single test file, e.g. pnpm test:run "src/core/commands/history.spec.ts"
pnpm lint             # ESLint check
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format check + write
pnpm check            # vue-tsc --noEmit (faster type-only check, no build)
```

Use `pnpm exec` or `pnpm dlx` instead of `npx` — this project uses pnpm as its package manager.

If `pnpm` is not on PATH, fall back to: `fnm exec --using default pnpm.cmd`

CLAUDE.md is a symlink to AGENTS.md. Always edit `AGENTS.md` directly — the Edit tool refuses to write through symlinks.

## Architecture: Three-Layer Design

```txt
src/
├── core/                  # Pure business logic (no Vue dependency)
│   ├── domain/project.ts  # Data model: ProjectDocument, LyricLine, LyricWord
│   ├── timing/             # Timing engine (no Vue dependency)
│   │   ├── timing-engine.ts    # Beat/bar computation from timing points
│   │   ├── timing-point.ts     # Sort + validate timing points
│   │   └── tap-bpm.ts          # Tap-based BPM estimator
│   └── commands/          # Command pattern for undo/redo
│       ├── command.ts     # Command<TState> interface {label, do, undo}
│       ├── history.ts     # createCommandHistory<T>() — undo/redo stack
│       └── project-commands.ts  # Command factories (e.g. createAddLyricLineCommand)
├── platform/              # Platform adapters (no Vue dependency)
│   ├── i18n/              # vue-i18n instance + zh-CN locale messages
│   ├── shortcuts/         # keystroke normalizer + registry (conflict detection)
│   ├── persistence/       # File System Access API adapter + save service
│   └── audio/              # AudioTransport (HTMLAudioElement) + Metronome (Web Audio API)
├── stores/                # Pinia stores — UI state orchestration
│   └── editor-store.ts    # Central editor session: project, undo/redo, save
├── composables/           # Vue composables
│   ├── useEditorShortcuts.ts    # Keyboard → action dispatch (accepts {onAction})
│   └── useProjectPersistence.ts # Ctrl+S save pipeline (wires store to file service)
├── components/shell/      # Editor shell — layout, transport, mode controls
│   ├── AppShell.vue       # Root layout, wires shortcuts + persistence to store
│   ├── TransportBar.vue   # Playback controls + progress slider with seek
│   ├── ModePanel.vue      # Tap BPM, metronome, time signature settings
│   ├── MenuBar.vue        # Top menu bar
│   └── MainView.vue       # Main content area
├── pages/index.vue        # Route page — renders AppShell
└── main.ts                # App bootstrap (Pinia → router → i18n)
```

## Key Constraints

- **UI never mutates data directly.** All state changes go through `Command` objects dispatched via `useEditorStore.execute()`. This guarantees undo/redo coverage for every editable action.
- **Time is always seconds (float).** Snap-to-grid is a UI-layer concern only.
- **`core/` and `platform/` are Vue-free.** They import zero Vue APIs. Only `stores/` and `composables/` use Vue reactivity (`shallowRef`, `computed`, `triggerRef`).
- **Persistence is decoupled from business logic.** The save pipeline (`project-file-service.ts` → `editor-store.saveProject` → `useProjectPersistence`) exchanges JSON strings. Replace the backend without touching `core/`.
- **After async mutations on `shallowRef` objects, call `triggerRef`.** Platform objects (AudioTransport, MetronomeScheduler) are held in `shallowRef`. Async operations that change internal state (loadFile, play, etc.) must be followed by `triggerRef(ref)` to wake computed properties that depend on those objects.
- **Metronome seek safety:** In `syncToTimeline`, always run backward-seek reset before duplicate-beat guard (`reset lastScheduledBeatTime` first, then `nextBeat.at <= lastScheduledBeatTime` check), and keep regression test `reschedules immediately after a backward timeline jump` green.

## Current Phase

Phase 1 (infrastructure base) and Phase 2 (audio + timing core) are complete. Remaining phases:

- Phase 3: Waveform/spectrogram views + grid system
- Phase 4: Lyrics timing (word-level editing, WordTimelineBar)
- Phase 5: Import/export plugins + shortcut rebinding UI

Test environment: Vitest + happy-dom + `@vue/test-utils`. Tests use `setActivePinia(createPinia())` in `beforeEach`. Test files live next to source files (`*.spec.ts`).

## Store Testing

The editor store uses `__override*Factory` exports for dependency injection. In tests, override factories before mounting:

```ts
__overrideAudioTransportFactory(() => mockAudioTransport)
__overrideMetronomeFactory(() => mockMetronomeScheduler)
setActivePinia(createPinia())
```

Avoid `vi.spyOn(store, 'actionName')` — Pinia wraps actions, making spies unreliable. Test state changes directly instead.

## Before Committing

Before committing or claiming work is done, always run `pnpm format` to normalize formatting.

## Tooling

Use **Context7** (`mcp__plugin_context7_context7__resolve-library-id` / `query-docs`) for up-to-date documentation of Vue, Pinia, Vite, Tailwind CSS, DaisyUI, and other dependencies. Use **WebSearch** for current information beyond training data. Prefer Context7 first for library docs, then web search if needed.
