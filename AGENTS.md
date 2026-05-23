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
pnpm check            # vue-tsc -b (same strictness as build, no bundle)
```

Use `pnpm exec` or `pnpm dlx` instead of `npx` — this project uses pnpm as its package manager.

Use plain `pnpm` first, if not found, fall back to: `fnm exec --using default pnpm.cmd`

CLAUDE.md is a symlink to AGENTS.md. Always edit `AGENTS.md` directly — the Edit tool refuses to write through symlinks.

## Tooling

**Always**: Use **Context7** MCP to get up-to-date documentation of Vue, Pinia, Vite, Tailwind CSS, DaisyUI, and other dependencies. Use **WebSearch** to get current information beyond training data. Prefer Context7 first for library docs, then web search if needed.

## Workflow Skills

- **TDD (mandatory)**: This project uses TDD. Before any code change — features, refactors, and bug fixes alike — invoke `test-driven-development`. Write/update tests first, then implement.
- **Bug fixing**: Always invoke `systematic-debugging` before proposing any fix.
- **Vue work**: Before touching `.vue` files, composables, Pinia stores, or any Vue-related code, invoke the `vue-best-practices`, `create-adaptable-composable` and `vue-pinia-best-practices` skill, before touching Vue related tests, invoke `vue-testing-best-practices`.

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
├── i18n/                  # vue-i18n instance + zh-CN locale messages (standalone Vue-dependent module)
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
│   ├── TransportBar.vue   # Playback controls + progress slider with seek
│   ├── TimingPointsPanel.vue  # Timing point panel (active/selected states, right-side controls)
│   ├── TimingPointList.vue    # Renders the list of timing points
│   ├── TimingPointControls.vue # Right-side controls for timing points
│   ├── LyricsPanel.vue        # Lyrics workspace (LyricsLineList + WordSplitBar)
│   ├── LyricsLineList.vue     # Scrollable line list with select/active states
│   ├── WordSplitBar.vue       # Cut/select mode word blocks panel
│   ├── LyricsPasteModal.vue   # Textarea modal for pasting lyrics
│   ├── VolumePopover.vue      # Volume control popover (music + SFX)
│   ├── MenuBar.vue        # Top menu bar
│   ├── MainView.vue       # Main content area
│   └── injection-keys.ts  # Symbol-based InjectionKey<T> definitions
├── test/setup.ts          # Global test setup (Iconify mock, etc.)
├── pages/index.vue        # Route page — renders AppShell
├── router/index.ts        # Vue Router setup
└── main.ts                # App bootstrap (Pinia → router → i18n)
```

## Current Phase

Phase 1 (infrastructure base), Phase 2 (audio + timing core), Phase 3 (waveform/spectrogram timeline view), and Phase 4 (lyrics timing) are complete. Remaining:

- Phase 5: Import/export plugins + shortcut rebinding UI

Test environment: Vitest + happy-dom + `@vue/test-utils`. Tests use `setActivePinia(createPinia())` in `beforeEach`. Test files live next to source files (`*.spec.ts`).

### Design Docs

Design decisions may evolve over time. If a newer document conflicts with an older one, defer to the newer document and ignore the conflicting parts of the older one.

- [Requirements spec](temp/docs/歌词打轴软件需求文档.md)
- [Phase 1–5 overall design](docs/superpowers/specs/2026-05-16-lyrics-maker-phased-design.md)
- [Phase 2 audio + timing design](docs/superpowers/specs/2026-05-16-phase-2-audio-timing-design.md)
- [Phase 3 pre-layout design](docs/superpowers/specs/2026-05-17-pre-phase-3-layout-design.md)
- [Phase 3 timeline view design](docs/superpowers/specs/2026-05-18-phase-3-timeline-view-design.md)
- [Phase 4 UX proposal chat](docs/superpowers/specs/2026-05-20-phase-4-ux-proposal-chat.md)
- [Phase 4 detailed proposal chat](docs/superpowers/specs/2026-05-20-phase-4-detailed-proposal-chat.md)
- [Phase 4 lyrics timing design](docs/superpowers/specs/2026-05-20-phase-4-lyrics-timing-design.md)
- [Phase 4 post fix lyrics UI/UX improvements design](docs/superpowers/specs/2026-05-23-phase-4-post-fix-lyrics-ui-improvements-design.md)

## Rules & Patterns

### Architecture & Layer Rules

- **UI never mutates data directly.** All state changes go through `Command` objects dispatched via `useEditorStore.execute()`. This guarantees undo/redo coverage for every editable action.
- **Time is always seconds (float).** Snap-to-grid is a UI-layer concern only.
- **`core/` and `platform/` are Vue-free.** `src/i18n/` is the standalone exception (requires `vue-i18n`). Only `stores/`, `composables/`, and `i18n/` import Vue APIs.
- **Persistence is decoupled from business logic.** The save pipeline (`project-file-service.ts` → `editor-store.saveProject` → `useProjectPersistence`) exchanges JSON strings. Replace the backend without touching `core/`.
- **Public API array parameters should use `readonly` when not mutated.** Inconsistent signatures (e.g. mutable `TimingPoint[]` where peers use `readonly`) are a type-safety regression.
- **Core timing error messages are English constants in `core/timing/errors.ts`.** Never import locale JSON from `platform/` or `i18n/` into `core/`. Add new error strings to `TIMING_ERRORS`.

### Command & Undo/Redo

- **State snapshots must use deep copy.** `{ ...obj }` is insufficient for nested state like `ProjectDocument`. Use `structuredClone(value)` for history/snapshot patterns that must protect against external mutation.
- **Command undo data belongs in `do()`, not factory scope.** Mutable closure variables in factory scope make commands non-reusable (second `do()` overwrites first undo data) and break when `undo()` is called before `do()`. Capture undo state inside `do()` and guard with `=== null` checks.
- **Command validation that depends on state must go in `do()`, not the factory.** Factory-level checks (e.g. `charIndex <= 0`) throw on construction. State-dependent checks (e.g. `charIndex >= word.text.length`) throw inside `do()`. Tests must call `cmd.do(state)` to trigger the latter.
- **`validateTimingPoint` must be called in commands.** The validator checks for NaN/Infinity BPM and negative values. Call it in `createAddTimingPointCommand` and `createUpdateTimingPointCommand` before returning the command object.
- **Undo/redo must re-sync hardware state.** Reverting project data via `history.undo()` does not automatically update the audio transport volume or metronome gain. After undo/redo, re-apply `musicVolume`/`sfxVolume` to the respective hardware.
- **Null sentinel `number | undefined | null` needs `?? undefined` for optional fields.** The undo-capture pattern (`let prev: number | undefined | null = null`) produces a 3-way type. When assigning back to an optional field like `endTime?: number`, use `prev ?? undefined` to narrow out `null`.

### Vue Reactivity & Composables

- **After async mutations on `shallowRef` objects, call `triggerRef`.** Platform objects (AudioTransport, MetronomeScheduler) are held in `shallowRef`. Async operations that change internal state (loadFile, play, etc.) must be followed by `triggerRef(ref)` to wake computed properties that depend on those objects.
- **`shallowRef` + `computed` does not track internal state changes.** `computed(() => shallowRef.value?.getIsPlaying())` will never re-evaluate. For booleans that need tracking, use a separate `ref<boolean>` and explicitly update it at every state transition.
- **In `async` functions, place reactive updates before the first `await`.** If `ref.value++` comes after `await transport.play()`, tests calling `store.action()` without `await` won't see the update immediately. However, **imperative side effects that depend on the async result must stay after the `await`** — e.g. `_startPlaybackLoop()` must come after `await transport.play()`, because the first `requestAnimationFrame` tick checks `transport.getIsPlaying()` and will terminate the loop if play hasn't started yet.
- **Composable async error handling pattern.** When a composable wraps async callbacks, expose an `onError?: (error, context) => void` hook instead of silently swallowing or always `console.error`-ing. This keeps tests deterministic and production behavior observable.
- **Use `loadError` ref pattern for async composable errors.** When a composable fires async operations (like `loadBlob`), expose a `ref<string | null>` that captures error messages. This lets UI bind to `loadError` reactively and prevents silent failures.
- **`normalizeKeystroke` returns `string | null`.** Returns `null` when `event.isComposing` is true (IME input). Callers must guard against null before using the result.
- **Lifted height state pattern.** When a child component's size is controlled by a parent (e.g. resize handle in AppShell controls MainView height), `provide(MAIN_VIEW_HEIGHT_KEY, ref(250))` in the parent and `inject(MAIN_VIEW_HEIGHT_KEY)` in the child (key defined in `src/components/shell/injection-keys.ts`). Tests pass it via `mount(C, { global: { provide: { [MAIN_VIEW_HEIGHT_KEY as symbol]: ref(N) } } })`. **Do NOT use `.value` on injected refs inside templates** — top-level injected refs auto-unwrap in `<script setup>` templates; calling `.value` bypasses the reactive dependency and updates are not tracked.
- **Use `Symbol`-based `InjectionKey<T>` for provide/inject.** Bare string keys lack type safety and are prone to typos. Define keys in `src/components/shell/injection-keys.ts` and import them in both provider and consumer components.
- **`useLyricsEditor` watch suppression for no-advance handlers.** The `watch` on `activeLine` re-derives `activeWordIndex` from data state (for undo/redo sync). Any handler that mutates timing data WITHOUT advancing `activeWordIndex` (e.g. `handleMarkNoAdvanceKey`) must set `_suppressWatchSync = true` before the mutation — the watch clears the flag and skips re-derivation for that tick.
- **`@vueuse/core` is available as a dependency.** Use `watchDebounced`, `useDebounceFn`, `useEventListener`, etc. from `@vueuse/core` instead of rolling manual debounce/throttle helpers.
- **Conditional hover popovers:** gate `@mouseenter` with a mode check (e.g. `verticalZoomPopoverOpen = timeline.viewMode.value === 'spectrogram'`) instead of using `v-if` on the whole wrapper — keeps the button always present but only opens the popover in the relevant mode.

### WaveSurfer & Timeline

- **WaveSurfer `ready` event must trigger grid update.** `GridOverlayPlugin._draw()` exits early when `duration <= 0`. After a view-mode switch the `scroll` event hasn't fired, so call `gridPlugin.update(params)` inside the `ready` handler to show lines immediately.
- **Grid overlay `zoom` handler must recompute `visibleStart`/`visibleEnd` before `_draw()`.** WaveSurfer's `zoom` event fires before the `scroll` event, so stale visible-range values produce grid lines at wrong positions. Recompute from `wrapper.scrollWidth`, `scrollContainer.scrollLeft`, and `duration` — same pattern as the `ready` handler.
- **WaveSurfer spectrogram vertical zoom via `frequencyMax`.** Set `frequencyMax = Math.round(22050 / zoom)` in `WindowedSpectrogramPlugin.create()` — not a post-init method. Requires recreating the WaveSurfer instance to take effect.
- **WaveSurfer waveform hidden in spectrogram mode:** set both `height: 0` and `waveColor: 'transparent'`. `height: 0` collapses the canvas; `waveColor: 'transparent'` prevents pixel bleed if height rounds up.
- **WaveSurfer `progressColor: 'transparent'` + `hideScrollbar: true`** when drawing a custom playhead overlay and managing scrolling manually.
- **WaveSurfer container needs `bg-black` in spectrogram mode only.** The spectrogram canvas renders on a transparent background; without `bg-black` the silence pixels look mismatched. Do not apply to waveform mode.
- **WaveSurfer wrapper uses Shadow DOM.** The wrapper div has a shadow root — `innerHTML` and `querySelector` on the wrapper return empty. Access internal elements (spectrogram wrapper, canvases) via `wrapper.shadowRoot.querySelector(...)`.
- **Spectrogram resize targets the plugin's wrapper div, not just the canvas.** The plugin sets `wrapper.style.height` as a fixed inline style. Use `ResizeObserver` on the container: CSS-stretch `plugin.wrapper` + canvas immediately during drag, then pixel-resize + call `plugin.render(ws.getDecodedData())` after a ~300ms debounce. Access private properties via `as unknown as { wrapper: HTMLElement; canvasContainer: HTMLElement; height: number }`.
- **WaveSurfer v7 decoded audio is `ws.getDecodedData()`** (not `getDecodedAudio`). Returns `AudioBuffer | null`.
- **WaveSurfer spectrogram rendering gaps:** enable `progressiveLoading: true` to pre-compute full-file spectrogram segments in background. Reduce `fftSamples` to 512 (must be power of 2) for faster segment computation. See `wavesurfer-view.ts:57-64`.

### Audio & Metronome

- **Metronome seek safety:** In `syncToTimeline`, always run backward-seek reset before duplicate-beat guard (`reset lastScheduledBeatTime` first, then `nextBeat.at <= lastScheduledBeatTime` check), and keep regression test `reschedules immediately after a backward timeline jump` green.
- **AudioTransport `getIsPlaying()` must read `!audioElement.paused` directly.** Chrome can cancel queued 'pause' event tasks when `src` changes immediately after `pause()` (e.g. replacing audio during playback), so event-driven `playing` flags become permanently stale. Never use event listeners to track play state for gate logic.
- **`importAudioFile` must explicitly stop playback before loading.** Browser events (pause/emptied) are unreliable when changing `audioElement.src` during playback. Always call `_stopPlaybackLoop()`, `_audioTransport.value?.pause()`, and reset `_isPlaying`/`_currentTime` synchronously before `loadFile`. Otherwise `_rafId` may block `_startPlaybackLoop` and `getIsPlaying()` may stay true.
- **`audioContext.resume()` only when suspended.** Check `audioContext.state === 'suspended'` before calling `resume()` in hot paths like `syncToTimeline` (fired every RAF frame). Calling `resume()` unconditionally allocates a Promise per frame at 60fps.
- **Platform objects that own resources must expose a `destroy()` that fully cleans up.** Never rely on GC alone for Web Audio API resources (AudioContext, AudioBufferSourceNode), object URLs, or event listeners.
- **`destroy()` must clean up pending async operations.** When a platform object manages async loads (e.g. `loadFile`), `destroy()` must call the pending cleanup function and revoke any blob URLs. Otherwise listeners dangle after the object is destroyed.

### Lyrics Timing

- **`snapToNearestGridPoint` finds nearest grid point (bidirectional).** Unlike `getNextSubdivisionTime` (forward-only) and `getPreviousSubdivisionTime` (backward-only), `snapToNearestGridPoint` returns whichever subdivision boundary is closest. Used by lyrics D-key snap logic.
- **`ProjectSettings.snapEnabled` controls grid snap globally.** When `false`, D/Shift+D/Enter write raw `currentTime` without snap or anti-overlap. TransportBar magnet button toggles this setting.
- **`splitBarMode` is a 3-state enum: `'cut' | 'timing' | 'edit'`.** Cut = split/merge words, timing = select words + set times (D/Enter auto-switch here), edit = inline word edit + whole-line rewrite. The old `'select'` mode was renamed to `'timing'`.
- **`autoSplitText` preserves trailing whitespace on each token** (except the last). `"hello world"` → `["hello ", "world"]`. Display code uses `word.text.trimEnd()` for visible text and `/\s$/.test(word.text)` to decide whether to show `␣` between words.
- **Space characters render as `␣` symbol.** Use `splitBySpaces(text)` to split text into space/non-space segments. Space segments render as `<span class="text-[10px] text-base-content/30">␣</span>` (one ␣ per space char). In cut-mode per-character rendering, use `v-if="char === ' '"` to substitute. Never trim or use `whitespace-pre`.
- **Lyrics line list word separators.** Always show `|` (`text-[8px] text-base-content/20`) between words regardless of trailing space. WordSplitBar timing/edit mode blocks have borders — no extra separators needed.

### Testing

- **`@iconify/vue` triggers real CDN fetches in happy-dom.** The `<Icon>` component lazily fetches icon JSON on first render; in happy-dom teardown these get aborted, producing `DOMException [AbortError]` noise. Global mock lives in `src/test/setup.ts` (`vi.mock('@iconify/vue', ...)`) — do not remove it.
- **`useEditorShortcuts` dispatches actions asynchronously (microtask).** Keyboard event handlers resolve via `Promise.resolve().then(...)`, so assertions after dispatching a key event must use `await vi.waitFor(() => expect(...))`, not synchronous `expect` or `await Promise.resolve()`.
- **Composable tests that call `seekPlayback` / `togglePlayback` must init audio transport.** `_audioTransport` starts as `null`; `seekPlayback` is a no-op without it. Call `await store.importAudioFile(new File([], 'test.mp3'))` in `async beforeEach` to trigger `_ensureAudioTransport()`.
- **Pinia setup store closure variables are invisible to DevTools `evaluate_script`.** Internal `_audioTransport`, `_rafId`, `_isPlaying` are not in `$state` or any public API. To debug, add temporary `console.log` in source — HMR won't reload Pinia stores, so use a full page refresh.

### CSS / Tailwind / Template

- **CSS `rotate` does not change the layout box.** For vertical sliders with `-rotate-90`, pair with `absolute` positioning and set `w-{N}` equal to the container's `h-{N}` to prevent flex/grid from collapsing the element to its content width.
- **Tailwind mutually-exclusive utilities must use conditional binding, not `class` + `:class` together.** When `border-l-transparent` and `border-l-success` both appear on an element, the generated CSS order determines precedence — HTML class order is irrelevant. Use `:class="{ 'border-l-success': active, 'border-l-transparent': !active }"` to keep them mutually exclusive. Apply a shared `border-l-[3px]` for consistent alignment across all rows.
- **Multi-line `@click` handlers crash the Vue template parser.** Newlines inside `@click="..."` cause the compiler-core tokenizer to fail at build time. Use comma expressions: `@click="(emit('foo'), (bar = null))"`.
- **`setPointerCapture` for drag handles.** Call `(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)` on `pointerdown` — routes all subsequent pointer events to that element without needing window-level `pointermove`/`pointerup` listeners.

### General TypeScript

- **Use `Math.round`, not `Math.floor`, for seconds<>milliseconds conversion.** `Math.floor(sec * 1000)` turns `8.030` (IEEE 754 actually `8.02999...`) into `8.029`, inconsistent with `.toFixed(3)` rounding. Always use `Math.round`.
- **Error re-throw must preserve the cause.** Use `throw new Error(msg, { cause: error })` instead of ``throw new Error(`msg: ${error.message}`)``. The `cause` option preserves the original stack trace for debugging.
- **Timing engine segment boundary handling must be consistent.** When adding a time-computation function, check whether sibling functions (`getNextBeatTime`, `getPreviousBarTime`, `getNextSubdivisionTime`) guard against crossing into the next/previous timing point's segment. Missing checks produce wrong results at BPM boundaries.

## Store Testing

The editor store uses `__override*Factory` exports for dependency injection. In tests, override factories before mounting:

```ts
__overrideAudioTransportFactory(() => mockAudioTransport)
__overrideMetronomeFactory(() => mockMetronomeScheduler)
setActivePinia(createPinia())
```

Avoid `vi.spyOn(store, 'actionName')` — Pinia wraps actions, making spies unreliable. Test state changes directly instead.

## Composable Testing

Composables that need a Vue component context are tested via a harness component:

```ts
const wrapper = mount(
  defineComponent({
    setup() {
      return useProjectPersistence({ onError })
    },
    template: '<div />',
  }),
)
```

Use `setActivePinia(createPinia())` before mount and override platform factories as needed. Assert by calling methods on the returned composable object or checking store state changes.

## Before Committing

Before committing or claiming work is done, always run `pnpm lint` then `pnpm format` to catch lint errors and normalize formatting.
