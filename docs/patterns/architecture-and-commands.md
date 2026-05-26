# Architecture And Command Patterns

## Architecture & Layer Rules

- **UI never mutates data directly.** All state changes go through `Command` objects dispatched via `useEditorStore.execute()`. This guarantees undo/redo coverage for every editable action.
- **Time is always seconds (float).** Snap-to-grid is a UI-layer concern only.
- **`core/` and `platform/` are Vue-free.** `src/i18n/` is the standalone exception (requires `vue-i18n`). Only `stores/`, `composables/`, and `i18n/` import Vue APIs.
- **Persistence is decoupled from business logic.** The save pipeline (`project-file-service.ts` -> `editor-store.saveProject` -> `useProjectPersistence`) exchanges JSON strings. Replace the backend without touching `core/`.
- **File autosave must never open a picker.** It should only write through an existing cached file handle. Browser draft restore loads project state as dirty; opening a project file loads it as clean.
- **Public API array parameters should use `readonly` when not mutated.** Inconsistent signatures (e.g. mutable `TimingPoint[]` where peers use `readonly`) are a type-safety regression.
- **Core timing error messages are English constants in `core/timing/errors.ts`.** Never import locale JSON from `platform/` or `i18n/` into `core/`. Add new error strings to `TIMING_ERRORS`.

## Command & Undo/Redo

- **State snapshots must use deep copy.** `{ ...obj }` is insufficient for nested state like `ProjectDocument`. Use `structuredClone(value)` for history/snapshot patterns that must protect against external mutation.
- **Command undo data belongs in `do()`, not factory scope.** Mutable closure variables in factory scope make commands non-reusable (second `do()` overwrites first undo data) and break when `undo()` is called before `do()`. Capture undo state inside `do()` and guard with `=== null` checks.
- **Command validation that depends on state must go in `do()`, not the factory.** Factory-level checks (e.g. `charIndex <= 0`) throw on construction. State-dependent checks (e.g. `charIndex >= word.text.length`) throw inside `do()`. Tests must call `cmd.do(state)` to trigger the latter.
- **`validateTimingPoint` must be called in commands.** The validator checks for NaN/Infinity BPM and negative values. Call it in `createAddTimingPointCommand` and `createUpdateTimingPointCommand` before returning the command object.
- **Undo/redo must re-sync hardware state.** Reverting project data via `history.undo()` does not automatically update the audio transport volume or metronome gain. After undo/redo, re-apply `musicVolume`/`sfxVolume` to the respective hardware.
- **Command-backed editable actions should publish status messages.** Use `showStatus()` after meaningful command execution and use `history.nextUndoLabel` / `nextRedoLabel` for undo/redo-facing status text.
- **Null sentinel `number | undefined | null` needs `?? undefined` for optional fields.** The undo-capture pattern (`let prev: number | undefined | null = null`) produces a 3-way type. When assigning back to an optional field like `endTime?: number`, use `prev ?? undefined` to narrow out `null`.

## General TypeScript

- **Use `Math.round`, not `Math.floor`, for seconds<>milliseconds conversion.** `Math.floor(sec * 1000)` turns `8.030` (IEEE 754 actually `8.02999...`) into `8.029`, inconsistent with `.toFixed(3)` rounding. Always use `Math.round`.
- **Error re-throw must preserve the cause.** Use `throw new Error(msg, { cause: error })` instead of ``throw new Error(`msg: ${error.message}`)``. The `cause` option preserves the original stack trace for debugging.
- **Timing engine segment boundary handling must be consistent.** When adding a time-computation function, check whether sibling functions (`getNextBeatTime`, `getPreviousBarTime`, `getNextSubdivisionTime`) guard against crossing into the next/previous timing point's segment. Missing checks produce wrong results at BPM boundaries.
- **Browser ID generation must use `createPrefixedId`.** Do not call `crypto.randomUUID()` directly in UI/store code; HTTP/non-secure contexts may not expose it. Use `src/platform/ids/create-id.ts`.
