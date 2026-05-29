# Phase 5 Plus Part 7 Export Validation And UI Polish Design

## Scope

This follow-up keeps validation focused on lyrics export. Importing lyrics and opening projects will not run the new semantic project validation gate.

The change has three parts:

- Run semantic project validation before exporting lyrics.
- Add a File menu action that validates the current project on demand.
- Apply small UI polish to `MenuBar`, `StatusBar`, and `PreferencesModal`.

## Export Validation

Add a Vue-free core validator for export readiness, owned near the project domain layer. It should accept the current `ProjectDocument` and the selected lyrics export target, then return a list of validation issues.

Each issue should include:

- `severity`: `error` or `warning`.
- `code`: stable machine-readable issue id.
- `path`: a display-oriented location such as `lyrics[2].words[4].endTime`.
- `messageKey`: i18n key for UI text.
- Optional params for line number, word number, time values, ids, or target format.

The validator must not mutate or normalize the project.

## Validation Rules

General project checks:

- Empty or whitespace-only project title is a warning.
- Empty, duplicate, or whitespace-only line, word, or timing point ids are errors.
- Any timing number that is not finite is an error.
- Negative time values are errors.

Timing point checks:

- BPM must be finite and greater than zero.
- Time signature numerator and denominator must be finite positive integers.
- Duplicate timing point times are warnings.

Lyrics line checks:

- A lyric line with an empty `words` array is an error.
- A line with any timed word but no `startTime` is an error for timed export targets.
- A line `startTime` after its final timed word `endTime` is an error.
- Timed lyric line intervals must not overlap with later timed lyric line intervals. If line A has an end time and line B has a start time, `lineAEnd > lineBStart` is an error.
- Timed lyric lines that appear out of chronological order are warnings, even if they do not overlap.

Word timing checks:

- A word `endTime` earlier than the previous boundary is an error. The previous boundary is the line `startTime` for the first timed word, otherwise the previous timed word `endTime`.
- A timed export target that requires word timing should warn when a visible word has no `endTime`.
- A line-level timed export target should warn when a line cannot provide both a start and an end boundary.
- Empty text words with `endTime` are valid silence placeholders.
- Empty text words without `endTime` are warnings because they cannot carry a boundary in exported timed formats.

Target-specific handling:

- TXT export may warn that timing information is discarded, but this should stay as the existing menu warning rather than a validation blocker.
- TTML, enhanced LRC, ESLyric, and ASS are word-timing-sensitive targets.
- ordinary LRC, SRT, and VTT are line-timing-sensitive targets.

All issues are warnings or errors only in presentation. The user may still continue exporting after reviewing them.

## Export Flow

When the user chooses a lyrics export target:

1. `AppShell` asks the validator to check the current project for that target.
2. If there are no issues, export proceeds immediately through the existing persistence flow.
3. If issues exist, show a validation warning modal before calling `persistence.exportLyrics`.
4. The modal lists issues grouped by severity, with concise location text and localized messages.
5. The modal offers `Cancel` and `Continue export`.
6. Continuing exports exactly the selected target once, without re-prompting for the same pending action.

StatusBar should report:

- validation passed when using the File menu validate action.
- validation found issues when using the validate action.
- export cancelled from the validation modal.

Export failure and success messages remain owned by the existing export flow.

## File Menu Validate Action

Add a File menu item named `Validate Project` near the export/save area.

The action runs validation against the current project without exporting. Because there is no selected target, it should run target-independent checks plus the broadest timing checks:

- general project checks.
- timing point checks.
- lyric line and word monotonicity checks.
- missing timing warnings that would affect timed exports.

If no issues exist, show a compact success modal or StatusBar message. If issues exist, show the same validation modal in read-only mode with a single close button.

## Modal Design

Create a reusable validation modal component rather than overloading the import confirmation dialog.

The modal should be compact and scannable:

- Title: project validation warning.
- Short summary: issue counts by severity.
- Scrollable issue list with severity label, location, and message.
- Buttons:
  - Read-only validation: `Close`.
  - Export gate: `Cancel`, `Continue export`.

The modal is a UI concern only; it receives already-localized or localizable issue data from `AppShell`.

## UI Polish

MenuBar:

- Slightly increase the side menu text size.
- If the larger text feels cramped, increase header height from the current compact height.
- Keep menu popup sizing with `w-max`, `min-w-*`, and `whitespace-nowrap`.

StatusBar:

- Match the height of the updated MenuBar.
- Keep the status text single-line and truncating.
- Increase font size only if it remains visually balanced with the menu.

PreferencesModal:

- Make the left category list slightly more compact.
- Add clear hover highlighting for every category item, similar to VSCode sidebar list hover behavior.
- Keep the selected category visually distinct from hover-only state.

These UI polish changes do not alter project data and do not require TDD-specific behavior tests, though existing component tests should continue to pass.

## Testing

Core validator tests should cover:

- duplicate ids.
- non-finite and negative times.
- invalid timing points.
- line intervals overlapping.
- line order warnings.
- word end time moving backward.
- empty placeholder word with and without `endTime`.
- target-specific missing word timing and line timing warnings.

UI/composable tests should cover:

- export without issues proceeds immediately.
- export with issues opens the validation modal.
- continuing from the modal calls the original export target.
- cancelling from the modal does not export and reports cancellation.
- File menu validate action shows pass/fail feedback.

Style-only changes can be verified with existing snapshots/DOM assertions where useful, plus manual visual inspection.
