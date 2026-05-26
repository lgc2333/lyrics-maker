# Timeline Wrapper Overlay Performance Design

## Context

The current timeline overlay implementation draws beat grid lines, lyric timing ranges, word separators, word labels, and the playhead on fixed canvases appended to the outer WaveSurfer container. The canvases do not scroll with WaveSurfer's internal content. On every relevant `currentTime`, `scroll`, `zoom`, `ready`, and `redraw` event, the plugins recompute the visible time range and redraw the canvas.

This works functionally, but playback auto-follow can feel uneven on high refresh-rate displays. The current playback follow path updates `store.currentTime`, redraws grid and lyric overlays, and may directly assign `scrollLeft` to keep the playhead centered. That creates a hot path where playback time, overlay redraw, and scroll correction are tightly coupled.

WaveSurfer's own plugins use a different model:

- Regions attach DOM elements to `wavesurfer.getWrapper()` and position them by audio-time percentage.
- Envelope attaches an SVG polyline to `wavesurfer.getWrapper()`.
- These overlays naturally scroll with WaveSurfer's internal scroll container.
- Playback-time work stays small. Regions only emits enter/leave events; Envelope only interpolates volume. They do not redraw their whole visual overlay on each playback frame.
- WaveSurfer playback auto-scroll uses a smooth catch-up model at low zoom instead of hard-centering on every tick.

## Goals

- Make playback auto-follow feel smooth on high refresh-rate displays.
- Move timeline content overlays into WaveSurfer's scroll coordinate system so browser scrolling carries them with the waveform or spectrogram.
- Avoid redrawing static grid and lyric overlays on every playback time update.
- Keep explicit seek scrolling separate from playback auto-follow.
- Preserve current waveform and spectrogram modes.
- Preserve current visual semantics:
  - Beat/bar/subdivision grid.
  - Red line for lyric line start.
  - Blue line for completed lyric line end.
  - Yellow dashed word separators.
  - Timed lyric range fill and word labels.
  - Playhead visibility even when there are no timing points.
- Keep platform waveform code Vue-free.

## Non-Goals

- Do not migrate audio playback ownership from `AudioTransport` to WaveSurfer.
- Do not implement overlay drag editing in this pass, though the design should leave a path for it.
- Do not redesign the timeline's visual language.
- Do not introduce a third-party rendering library for this work.

## Recommended Direction

Use a C+ architecture:

- Attach timeline content overlays to `wavesurfer.getWrapper()`, matching Regions and Envelope.
- Render the grid as a virtualized SVG overlay.
- Render lyric line and word timing overlays as virtualized DOM or SVG elements inside the wrapper.
- Render the playhead as a separate fixed viewport overlay, not as part of the grid.
- Use a smooth catch-up playback scroll algorithm modeled after WaveSurfer's renderer.

This keeps the scroll-heavy content in the same coordinate system as WaveSurfer while keeping the playback-time hot path small.

## Architecture

### WaveSurferView Responsibilities

`WaveSurferView` should expose a small set of DOM and geometry helpers so plugins and the timeline composable do not reach through private assumptions repeatedly:

- `getWrapper()` returns WaveSurfer's content wrapper.
- `getScrollContainer()` returns the wrapper's scroll parent.
- `getDuration()` returns the current audio duration.
- `getPixelsPerSecond()` returns `wrapper.scrollWidth / duration` when duration is positive.
- `getVisibleRange()` returns `{ start, end, scrollLeft, clientWidth, scrollWidth }`.
- `scrollPlaybackTo(time, thresholdRatio)` uses smooth catch-up behavior.
- `scrollSeekTo(time, marginRatio)` keeps the current explicit seek behavior: targets outside the visible 10%-90% band move to the nearest 10% edge.

The wrapper helpers should be implemented inside `wavesurfer-view.ts`; platform plugins can still use WaveSurfer plugin APIs, but repeated shadow-DOM and parent-element assumptions should be centralized where practical.

### Overlay Layers

The timeline should use three conceptual layers:

1. **Grid content layer**
   - Attached to `wavesurfer.getWrapper()`.
   - Uses SVG or DOM lines positioned in the wrapper coordinate system.
   - Updates on timing point changes, divisor/triplet changes, ready, zoom, resize, and scroll virtualization events.
   - Does not update on playback `currentTime`.

2. **Lyrics content layer**
   - Attached to `wavesurfer.getWrapper()`.
   - Renders lyric line ranges, start/end boundaries, word separators, and labels.
   - Updates on lyric data changes, active line changes, ready, zoom, resize, and scroll virtualization events.
   - Does not update on playback `currentTime` except for future active-at-time highlighting if explicitly added.

3. **Viewport playhead layer**
   - Attached to the outer container, fixed to the viewport.
   - Renders only the current-time playhead.
   - Updates on playback `currentTime`, explicit seek, scroll, zoom, and ready.
   - Uses `transform: translateX(...)` rather than canvas redraw.

The layer split is important: playback should only move the playhead and maybe scroll the container. It should not rebuild grid or lyric visuals.

## Grid Rendering

The grid should move from fixed canvas to a virtualized wrapper-attached SVG overlay.

### Coordinate Model

For duration `d` and wrapper width `w`:

- `pxPerSec = w / d`
- `x = time * pxPerSec`

The SVG should be absolutely positioned inside the wrapper:

- `position: absolute`
- `inset: 0`
- `width: 100%`
- `height: 100%`
- `pointer-events: none`

Grid lines should use `x1 = x2 = time * pxPerSec`. Because the SVG scrolls with the wrapper, the line does not need to subtract `visibleStart`.

### Virtualization

The grid should not render all lines for the entire file at high subdivision density.

On scroll/zoom/ready/setting changes:

- Compute visible range from scroll container.
- Add a small time buffer on each side, initially `0.5s`.
- Generate grid lines only for that buffered range using `getBeatGridLines(...)`.
- Render those lines into the wrapper-attached SVG.

This still listens to scroll, but the work is limited to generating visible lines and patching SVG children. It avoids canvas full redraw on playback `currentTime`.

### Empty Timing Points

When there are no timing points, the grid layer should clear grid lines but leave the playhead layer unaffected. This preserves the current regression requirement that deleting the last timing point does not leave stale grid lines and does not hide the playhead.

## Lyrics Rendering

The lyrics overlay should follow the same wrapper coordinate system as the grid.

### Rendering Rules

The initial migration should preserve current completed-line behavior:

- Lines without `startTime` are not rendered.
- Completed lines render from `line.startTime` to the last word's `endTime`.
- Line start boundary is red.
- Completed line end boundary is blue.
- Word separators are yellow dashed boundaries.
- Word labels use trimmed display text and fit within the word range.

The design should also be compatible with the later Part 4 behavior:

- Partially timed lines can render from `startTime` to the last continuous timed word.
- Incomplete lines should not draw a final blue sentence-end boundary.

### DOM vs SVG

Lyrics may use DOM or SVG. The recommended first implementation is DOM for range blocks and labels, with CSS classes for fills and boundaries:

- One absolutely positioned element per visible line range.
- Optional child elements for start/end boundaries.
- Child elements for visible word separators and labels.

DOM is acceptable here because lyric line and word counts are much lower than beat subdivision counts, and future drag editing will benefit from DOM hit targets. If real projects show very high word counts, the same visibility window used for grid should be applied to lyrics.

### Virtualization

The plugin should render only lyric elements that intersect the buffered visible range:

- Include a line if its visible timed segment intersects the buffered range.
- Include a word separator or label only if it intersects the buffered range or lies within a rendered line segment.

This mirrors Regions' `virtualAppend` idea without requiring every lyric element to remain mounted for the full song.

## Playhead Rendering

The playhead should be removed from `GridOverlayPlugin` and implemented as a separate viewport overlay.

Recommended behavior:

- Append a single `div` to the outer WaveSurfer container.
- Style it as an absolute vertical red line with `pointer-events: none`.
- Compute viewport X as `currentTime * pxPerSec - scrollLeft`.
- Apply it with `transform: translateX(${x}px)`.
- Hide or move offscreen when duration is invalid or the computed X is outside a small viewport buffer.

This makes the playback-time path cheap: one transform update, no grid redraw.

## Playback Follow

Playback auto-follow should use WaveSurfer-style smooth catch-up, not hard centering.

Current behavior hard-centers when the playhead crosses the threshold:

```ts
scrollLeft = time * pxPerSec - clientWidth / 2
```

Recommended behavior:

- If playhead is outside the viewport, recenter immediately.
- If playhead is inside the viewport and still left of the threshold, do nothing.
- If playhead is inside the viewport and right of the threshold, scroll by the catch-up delta.
- At low zoom, cap the per-frame scroll delta.
- At high zoom, allow direct catch-up because the required delta is visually smaller in time.

Initial constants should mirror WaveSurfer:

- Smooth scroll max delta: `10px` per playback follow tick.
- Low zoom threshold: `600px/s`.

Pseudo-code:

```ts
const targetX = time * pxPerSec
const playheadX = targetX - scrollLeft
const centerX = clientWidth * thresholdRatio

if (playheadX < 0 || playheadX > clientWidth) {
  scrollLeft = Math.max(0, targetX - clientWidth / 2)
  return
}

const overflow = playheadX - centerX
if (overflow <= 0) return

const delta = pxPerSec <= 600 ? Math.min(overflow, 10) : overflow

scrollLeft += delta
```

The existing user-scroll cooldown and auto-follow toggle should remain. Explicit seek scrolling must remain independent from the auto-follow toggle.

## Data Flow

`useTimelineView` should stop treating `store.currentTime` as a trigger to update every overlay.

Recommended watchers:

- `store.currentTime`
  - Update playhead position.
  - If playing and auto-follow is enabled and user-scroll cooldown has expired, call smooth `scrollPlaybackTo(...)`.
  - Do not update grid or lyric content overlays.

- Timing points, divisor, triplets
  - Update grid content layer.

- Lyrics, active line
  - Update lyrics content layer.

- WaveSurfer scroll, zoom, ready, redraw/resize
  - Update virtualized grid and lyric content windows.
  - Update playhead position.

- Seek request
  - Run `scrollSeekTo(time, 0.1)`.
  - Update playhead position.

## Migration Plan

This should be implemented in staged changes rather than one large replacement.

### Stage 1: Smooth Follow And Playhead Split

- Add a dedicated playhead overlay.
- Remove playhead drawing from the grid canvas.
- Change playback follow to smooth catch-up.
- Keep existing canvas grid and lyric overlays temporarily.

This stage should already reduce playback-time redraw work and should make high refresh-rate auto-follow visibly smoother.

### Stage 2: Wrapper-Attached Grid Overlay

- Replace fixed canvas grid with wrapper-attached SVG grid.
- Virtualize grid lines by visible range.
- Preserve empty timing point behavior.
- Keep line overlay canvas temporarily.

### Stage 3: Wrapper-Attached Lyrics Overlay

- Replace fixed canvas line overlay with wrapper-attached lyric DOM/SVG overlay.
- Virtualize visible lyric segments.
- Preserve current completed-line rendering.
- Leave room for Part 4 partial-line rendering.

### Stage 4: Cleanup And Pattern Update

- Remove old fixed-canvas overlay assumptions from docs and tests.
- Update `docs/patterns/timeline-audio-lyrics.md` with the new overlay rules.
- Add regression tests around playback hot-path behavior.

## Testing Strategy

### Unit Tests

- Smooth follow:
  - Does not scroll while playhead is left of the threshold and visible.
  - Recenters immediately when playhead is outside the viewport.
  - Caps low-zoom scroll delta to `10px`.
  - Allows full catch-up at high zoom.
  - Respects auto-follow toggle and user-scroll cooldown through `useTimelineView`.

- Grid overlay:
  - Appends content to WaveSurfer wrapper, not the outer container.
  - Generates only buffered visible grid lines.
  - Clears grid lines when timing points become empty.
  - Does not depend on current time for grid line rendering.

- Playhead overlay:
  - Updates by transform from current time and scroll position.
  - Remains visible without timing points.
  - Cleans up DOM on destroy.

- Lyrics overlay:
  - Renders completed timed lines with current visual semantics.
  - Skips lines without `startTime`.
  - Virtualizes lines outside the buffered visible range.
  - Cleans up DOM on destroy.

### Integration Tests

- `useTimelineView` current-time watcher updates playhead and scroll follow without calling grid/lyrics update.
- Explicit seek still scrolls to the 10% margin band even when auto-follow is disabled.
- View mode switches recreate overlays and restore scroll time.

### Manual Verification

- Playback auto-follow on a high refresh-rate display feels continuous rather than jumpy.
- Waveform and spectrogram modes both show grid, lyric overlay, and playhead.
- Zoom around cursor preserves the intended anchor time.
- Deleting the last timing point clears grid lines but leaves playhead visible.
- Long songs with dense subdivisions do not create unbounded DOM nodes.

## Risks And Mitigations

- **DOM node count can grow too large.**
  - Mitigation: grid must be virtualized from the first wrapper-attached implementation. Lyrics should also use visible-range filtering.

- **Wrapper-attached overlays may interact differently with WaveSurfer shadow DOM.**
  - Mitigation: follow Regions and Envelope by using `wavesurfer.getWrapper()` directly. Keep outer-container overlays only for viewport-fixed UI such as the playhead.

- **Spectrogram wrapper layout may differ from waveform layout.**
  - Mitigation: verify both modes after each stage. Keep overlay layers attached to the common WaveSurfer wrapper, not spectrogram-private internals.

- **SVG text and DOM text may render differently from canvas labels.**
  - Mitigation: preserve approximate font sizes and opacity first; defer visual polish unless regressions are obvious.

- **Scroll virtualization may lag if scroll events fire rapidly.**
  - Mitigation: batch virtualization updates with `requestAnimationFrame` if direct scroll handling shows jank.

## Decisions To Confirm

The recommended defaults for the implementation plan are:

- Grid layer: SVG, virtualized by visible range plus `0.5s` buffer.
- Lyrics layer: DOM elements, virtualized by visible range plus `0.5s` buffer.
- Playhead: fixed outer-container DOM line using `transform`.
- Smooth follow constants: `10px` max delta below `600px/s`.
- Migration order: playhead and smooth follow first, grid second, lyrics third.

These defaults keep the first implementation measurable and reversible while still moving toward the wrapper-attached architecture.

## Acceptance Criteria

- Playback no longer redraws grid or lyric content overlays on every `currentTime` update.
- Playback auto-follow uses smooth catch-up and no longer hard-centers every tick once past the threshold.
- Grid and lyric content overlays scroll with WaveSurfer's internal content.
- Explicit seek behavior remains separate from playback auto-follow.
- The playhead remains visible and accurate when there are no timing points.
- Overlay DOM/SVG nodes are bounded by visible-range virtualization for grid and lyrics.
- Existing waveform and spectrogram modes continue to work.
