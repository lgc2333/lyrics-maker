# Lyrics UI/UX Improvements — Design Spec

**Date:** 2026-05-23
**Scope:** 9 UI/UX improvements spanning layout, lyrics display, word split bar, overlay plugin, and mode system.

---

## A. Layout Fix (Tasks #1, #5)

### Problem

LyricsPanel uses `flex flex-1 flex-col` without `min-h-0`, causing content overflow to push the entire page (spectrogram, menu bar) off-screen when scrolling the lyrics list. Additionally, WordSplitBar is positioned below LyricsLineList but should be above it.

### Changes

1. **AppShell.vue** root `div.flex.h-screen.flex-col`: add `overflow-hidden` to prevent any child from expanding beyond the viewport.
2. **LyricsPanel.vue** root div: add `min-h-0` so the `flex-1` correctly constrains height.
3. **LyricsPanel.vue**: swap the order of WordSplitBar and LyricsLineList — WordSplitBar on top (with `border-b` instead of `border-t`), LyricsLineList below in the `min-h-0 flex-1 overflow-hidden` container.

---

## B. Space Tracking & Display (Tasks #2, #3)

### Data Model

No schema change. Trailing spaces are stored directly in `word.text`. For example, `"Kissed all the rings"` auto-splits into words with text `"Kissed "`, `"all "`, `"the "`, `"rings"` — the space is part of the preceding word's text.

### auto-split Changes

`autoSplitText` return type stays `string[]`, but the algorithm changes: instead of splitting by `/\s+/` and discarding spaces, it preserves trailing spaces on each token (except the last).

Algorithm: match tokens with `text.matchAll(/(\S+)(\s*)/g)`. For each match, the word text is `match[1] + match[2]` (non-whitespace + trailing whitespace). The last word's trailing whitespace is trimmed.

Example: `"Kissed  all the rings"` → `["Kissed  ", "all ", "the ", "rings"]`.

Manual word splits (`splitWord` command) do NOT add spaces — the split produces words with no trailing whitespace.

### Display Rules

Display logic checks `word.text.endsWith(' ')` (or more precisely, `/\s+$/`) to determine if a word has trailing space.

- **LyricsLineList**: render each word as a `<span>`, with a thin dark divider between adjacent words. If the preceding word's text ends with whitespace, render `␣` (in dim/muted style) at the divider position instead of a plain line. The word text is displayed trimmed (trailing spaces stripped from display, shown as ␣ separator instead).
- **WordSplitBar**: same convention — show `␣` between word blocks where the preceding word's text ends with whitespace, otherwise just the split line. Word block labels display trimmed text.

---

## C. Word-by-Word Lyrics Display (Task #4)

### Rendering

Replace `getLineText()` (which returns `join('')`) with per-word `<span>` rendering in LyricsLineList. Each word gets a CSS class based on its timing state relative to `store.currentTime`:

| State    | Condition                                                                                | Style             |
| -------- | ---------------------------------------------------------------------------------------- | ----------------- |
| Played   | `word.endTime !== undefined && word.endTime <= currentTime`                              | Normal text color |
| Playing  | word's derived startTime <= currentTime AND (endTime undefined OR endTime > currentTime) | `font-bold`       |
| Unplayed | Everything else                                                                          | `opacity-50`      |

A word's derived startTime:

- First word (index 0): `line.startTime`
- Subsequent words: `words[i-1].endTime`

If `line.startTime` is undefined, all words in that line are "unplayed".

### Reactivity

`store.currentTime` is already a reactive ref updated via RAF during playback. The per-word styling will recompute on each `currentTime` change. Since LyricsLineList already re-renders on lyrics data changes, no additional subscription is needed.

---

## D. Click Target Widening (Task #6)

### Problem

Both `char-gap` (cut mode character split points) and `split-line` (word merge points) are `w-px` (1px wide), making them nearly impossible to click.

### Solution

Change the outer hit-target element to `w-3` (12px) with `flex items-center justify-center`. The visual indicator (1px line) remains inside as a child `div` with `w-px h-5`. The click handler stays on the 12px outer element.

This applies to both `char-gap` and `split-line` elements in WordSplitBar.

---

## E. Enter Key Last-Line Bug (Task #7)

### Problem

`handleNextLineKey()` at line 134:

```ts
if (lineIndex === -1 || lineIndex >= lyrics.length - 1) return
```

On the last line, this returns immediately — the last word's endTime is never set.

### Fix

Before the early return for last line, extract the "set last word endTime" logic (lines 138–145) and execute it. The early return should only skip the "advance to next line" part, not the "finalize current line" part.

Pseudocode:

```ts
function handleNextLineKey(currentTime?: number): void {
  // ... find line, lineIndex ...

  // Finalize current line's last word (runs for ALL lines including last)
  if (line.startTime !== undefined) {
    const rawTime = currentTime ?? store.currentTime
    const time = _getSnappedTime(rawTime)
    const lastWord = line.words[line.words.length - 1]
    if (lastWord) {
      const prevEnd = _getPrevEndTime(line.words.length - 1)
      const clamped = clampWordTime(time, prevEnd, store.duration)
      store.setWordEndTime(activeLineId.value, lastWord.id, clamped)
    }
  }

  // Advance to next line (skip if last line)
  if (lineIndex >= lyrics.length - 1) return
  // ... activate next line ...
}
```

---

## F. Aegisub-Style Line Overlay (Task #8)

### Reference

The Aegisub screenshot shows:

- **Sentence start**: solid red vertical line (2px)
- **Sentence end**: solid blue vertical line (2px)
- **Word separators**: dotted white/light-blue vertical lines
- **Word text**: white labels centered within each word's time span, positioned in the upper portion of the waveform/spectrogram
- **Sentence region**: semi-transparent blue fill (brighter for active line)

### Changes to `LineOverlayPlugin._draw()`

1. **Sentence background fill**: keep, adjust alpha — active line `rgba(100, 180, 255, 0.12)`, inactive `rgba(100, 180, 255, 0.05)`.
2. **Sentence start boundary**: 2px solid red line (`rgba(255, 80, 80, 0.8)`).
3. **Sentence end boundary**: 2px solid blue line (`rgba(100, 180, 255, 0.8)`).
4. **Word separator lines**: change to dashed (`ctx.setLineDash([4, 3])`) with color `rgba(255, 255, 255, 0.5)`.
5. **Word text labels**: for each word with a computable time span, draw `ctx.fillText(word.text, centerX, y)` in white with a dark text shadow (`ctx.shadowColor = 'rgba(0,0,0,0.7)', shadowBlur = 2`). Position vertically at ~20% from top. Font size scales with available space but clamped to 10–14px.

### `LineOverlayParams` Update

The `params` already include `lyrics: LyricLine[]`. Word text is accessible via `line.words[i].text`. Word start times are derived (first word = `line.startTime`, subsequent = previous word's `endTime`).

---

## G. Three-State Mode Switch (Task #9)

### Mode Enum

```ts
type SplitBarMode = 'cut' | 'timing' | 'edit'
```

Replaces the current `'cut' | 'select'`. The existing `'select'` mode becomes `'timing'`.

### UI: Segmented Control

The single toggle button becomes a 3-segment tab/button group:

- **Cut** (✂️ `material-symbols:content-cut`): orange/warning active style
- **Timing** (⏱ `material-symbols:timer-outline`): primary active style
- **Edit** (✏️ `material-symbols:edit-outline`): info active style

Each segment is a small button. Active segment gets colored background; inactive segments are ghost style.

### Mode Behaviors

**Cut mode** — unchanged from current `'cut'`:

- Characters shown individually with 12px gap hotspots
- Click gap to split word, click split-line to merge

**Timing mode** — renamed from current `'select'`:

- Word blocks shown, click to select/activate
- Numeric time editor shown for active word
- D/Shift+D/Enter key handlers auto-switch `splitBarMode` to `'timing'`

**Edit mode** — new:

- Word blocks become clickable for inline editing (click → small `<input>` overlay replacing the word block text)
- Gaps between word blocks are clickable to insert a new empty word
- A toolbar button ("Edit as text" / full-line icon) switches to whole-line input mode:
  - Entire line becomes a single `<textarea>` or `<input>` pre-filled with current text (words joined, trailing spaces preserved naturally)
  - Confirm (✓) button: clears all timing data for the line, runs `autoSplitText` on the input, replaces line's words
  - Cancel (✗) button: discards changes, returns to word-block view
- Word block inline edit: blur or Enter confirms, Escape cancels. Only changes the word's `text` field (timing data preserved).
- Insert new word: creates a `LyricWord` with empty text and no timing at the clicked position.

### Auto-Switch to Timing Mode

In `useLyricsEditor`, when `handleMarkKey`, `handleNextLineKey`, or `handleMarkNoAdvanceKey` is called, set `splitBarMode.value = 'timing'` at the start of the function (before any early returns, but after the `activeLineId` check).

---

## Implementation Order

The tasks have natural dependencies:

1. **B (data model + auto-split)** — foundation for space tracking; other tasks depend on LyricWord shape
2. **A (layout fix)** — independent, simple CSS changes
3. **E (Enter key bug)** — independent logic fix
4. **D (click targets)** — independent CSS/template change
5. **C (word-by-word display)** — depends on B for space rendering in lyrics list
6. **F (Aegisub overlay)** — independent of other UI tasks
7. **G (three-state switch)** — largest change, depends on B for space display in edit mode

Tasks A, B, D, E can be done in parallel. C follows B. F is independent. G depends on B and conceptually comes last.
