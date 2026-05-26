# AGENTS.md

This file provides guidance to agents when working with code in this repository.

CLAUDE.md is a symlink to AGENTS.md. Always edit `AGENTS.md` directly — the Edit tool refuses to write through symlinks.

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
pnpm check            # vue-tsc -b (same strictness as build, no bundle)
```

Use `pnpm exec` or `pnpm dlx` instead of `npx` — this project uses pnpm as its package manager.

Use plain `pnpm` first, if not found, fall back to: `fnm exec --using default pnpm.cmd`

## Tooling

**Always**: Use **Context7** MCP to get up-to-date documentation of Vue, Pinia, Vite, Tailwind CSS, DaisyUI, and other dependencies. Use **WebSearch** to get current information beyond training data. Prefer Context7 first for library docs, then web search if needed.

## Workflow Skills

- **TDD (mandatory)**: This project uses TDD. Before any code change — features, refactors, and bug fixes alike — invoke `test-driven-development`. Write/update tests first, then implement.
- **Bug fixing**: Always invoke `systematic-debugging` before proposing any fix.
- **Vue component work**: Before touching `.vue` files or other Vue-related code, invoke `vue-best-practices`.
- **Vue composable work**: Before touching composables, invoke `vue-best-practices` and `create-adaptable-composable`.
- **Pinia store work**: Before touching Pinia stores, invoke `vue-best-practices` and `vue-pinia-best-practices`.
- **Vue test work**: Before touching Vue-related tests, invoke `vue-testing-best-practices`.

If a required skill cannot be found in the workspace, stop the current operation first and ask the user whether to install workspace skills with `pnpm dlx skills update -p`.

## Architecture: Three-Layer Design

```txt
src/
├── core/                  # Pure business logic (no Vue dependency)
│   ├── domain/project.ts  # Data model: ProjectDocument, LyricLine, LyricWord
│   ├── timing/             # Timing engine (no Vue dependency)
│   │   ├── timing-engine.ts    # Beat/bar computation from timing points
│   │   ├── timing-point.ts     # Sort + validate timing points
│   │   ├── tap-bpm.ts          # Tap-based BPM estimator
│   │   └── errors.ts           # English error constants (never import i18n here)
│   ├── lyrics/             # Lyrics processing (no Vue dependency)
│   │   ├── auto-split.ts       # Text → word array splitting
│   │   └── snap-time.ts        # Snap time to nearest grid point
│   ├── utils/              # format-timestamp.ts
│   └── commands/          # Command pattern for undo/redo
│       ├── command.ts     # Command<TState> interface {label, do, undo}
│       ├── history.ts     # createCommandHistory<T>() — undo/redo stack
│       ├── project-commands.ts  # Command factories (timing points, settings, audio)
│       └── lyrics-commands.ts   # Lyrics command factories (timing, split/merge, insert/remove)
├── i18n/                  # vue-i18n instance + locale messages (standalone Vue-dependent module)
│   └── locales/           # Locale message files
├── platform/              # Platform adapters (strictly Vue-free)
│   ├── shortcuts/         # keystroke normalizer + registry (conflict detection)
│   ├── persistence/       # File System Access API adapter + save service
│   ├── audio/              # AudioTransport (HTMLAudioElement) + Metronome (Web Audio API)
│   └── waveform/          # WaveSurfer.js lifecycle + overlay plugins
│       ├── wavesurfer-view.ts       # WaveSurfer lifecycle management
│       ├── grid-overlay-plugin.ts   # Beat/bar grid lines on timeline
│       ├── line-overlay-plugin.ts   # Lyrics sentence/word visualization on timeline
│       └── worker-threads-shim.ts   # Web Worker compatibility shim
├── stores/                # Pinia stores — UI state orchestration
│   └── editor-store.ts    # Central editor session: project, undo/redo, save
├── composables/           # Vue composables
│   ├── useEditorShortcuts.ts    # Keyboard → action dispatch (accepts {onAction})
│   ├── useLyricsEditor.ts       # Lyrics timing state machine (D/Enter/Shift+D key handlers)
│   ├── useProjectPersistence.ts # Ctrl+S save pipeline (wires store to file service)
│   └── useTimelineView.ts       # WaveSurfer orchestration (view mode, zoom, scroll sync)
├── components/shell/      # Editor shell — layout, transport, mode controls
│   ├── AppShell.vue       # Root layout, wires shortcuts + persistence to store
│   ├── TransportBar.vue   # Playback controls, progress slider, view/zoom/volume controls
│   ├── TimingPointsPanel.vue  # Timing point panel (active/selected states, right-side controls)
│   ├── TimingPointList.vue    # Renders the list of timing points
│   ├── TimingPointControls.vue # Right-side controls for timing points
│   ├── LyricsPanel.vue        # Lyrics workspace (LyricsLineList + WordSplitBar)
│   ├── LyricsLineList.vue     # Scrollable line list with select/active states
│   ├── WordSplitBar.vue       # Cut/timing/edit mode word blocks panel
│   ├── LyricsPasteModal.vue   # Textarea modal for pasting lyrics
│   ├── VerticalSliderPopover.vue # Reusable icon button + vertical slider popover
│   ├── MenuBar.vue        # Top menu bar
│   ├── MainView.vue       # Main content area
│   └── injection-keys.ts  # Symbol-based InjectionKey<T> definitions
├── test/setup.ts          # Global test setup (Iconify mock, etc.)
├── pages/index.vue        # Route page — renders AppShell
├── router/index.ts        # Vue Router setup
└── main.ts                # App bootstrap (Pinia → router → i18n)
```

## Current Phase

Phase 1 (infrastructure base), Phase 2 (audio + timing core), Phase 3 (waveform/spectrogram timeline view), and Phase 4 (lyrics timing) are complete. Phase 5 Plus Part 1 (status bar + no-audio editing boundaries) and Part 2 (timing menu/WordSplitBar UI fixes) are complete. Remaining:

- Phase 5: Import/export plugins + shortcut rebinding UI.
- Phase 5 Plus: Part 3+ timeline scrolling, seek-follow, and zoom behavior.

Test environment: Vitest + happy-dom + `@vue/test-utils`. Tests use `setActivePinia(createPinia())` in `beforeEach`. Test files live next to source files (`*.spec.ts`).

### Design Docs

Design decisions may evolve over time. If a newer document conflicts with an older one, defer to the newer document and ignore the conflicting parts of the older one. The list below is ordered from oldest to newest.

- [Initial design spec](docs/initial-design-spec.md)
- [Phase 1–5 overall design](docs/superpowers/specs/2026-05-16-lyrics-maker-phased-design.md)
- [Phase 2 audio + timing design](docs/superpowers/specs/2026-05-16-phase-2-audio-timing-design.md)
- [Phase 3 pre-layout design](docs/superpowers/specs/2026-05-17-pre-phase-3-layout-design.md)
- [Phase 3 timeline view design](docs/superpowers/specs/2026-05-18-phase-3-timeline-view-design.md)
- [Phase 4 UX proposal chat](docs/superpowers/specs/2026-05-20-phase-4-ux-proposal-chat.md)
- [Phase 4 detailed proposal chat](docs/superpowers/specs/2026-05-20-phase-4-detailed-proposal-chat.md)
- [Phase 4 lyrics timing design](docs/superpowers/specs/2026-05-20-phase-4-lyrics-timing-design.md)
- [Phase 4 post fix lyrics UI/UX improvements design](docs/superpowers/specs/2026-05-23-phase-4-post-fix-lyrics-ui-improvements-design.md)
- [Phase 5 Plus spec](docs/phase-5-plus-spec.md)

## Rules & Patterns

Detailed project rules live in focused pattern docs:

- [Architecture and command patterns](docs/patterns/architecture-and-commands.md): layer boundaries, command/undo rules, and TypeScript gotchas.
- [Vue and UI patterns](docs/patterns/vue-and-ui.md): Vue reactivity, composables, Tailwind, DaisyUI, and template rules.
- [Timeline, audio, and lyrics patterns](docs/patterns/timeline-audio-lyrics.md): WaveSurfer, metronome/audio, and lyrics timing rules.
- [Testing patterns](docs/patterns/testing.md): test environment, Vue/store/composable test setup, and testing gotchas.

When starting work, proactively read the linked pattern docs relevant to the files or domain you will touch. When adding new durable project rules, update the relevant linked `docs/patterns/*` file instead of appending them under this section.

## Before Committing

Use semantic/conventional commit messages, e.g. `fix: keep vertical slider popovers reachable`.

Before committing or claiming work is done, always run `pnpm lint` then `pnpm format` to catch lint errors and normalize formatting. Run `pnpm check` too when Vue or TypeScript types changed.
