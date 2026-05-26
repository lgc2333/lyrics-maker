# Lyrics Selection And Interval Playback Design

## Scope

This design covers three Phase 5 Plus follow-up fixes:

- Selecting a different lyric line in timing mode should reset the WordSplitBar to the start block, while selecting the same line again should preserve the user's current word selection.
- Clicking a start or word block in the WordSplitBar timing mode should seek to the corresponding known timing position.
- The play-current-line and play-current-word shortcuts should stop at the correct endpoint and handle playback/seek edge cases predictably.
- Spectrogram mode must not cover the timing grid, playhead, hover time preview, or lyric overlay.

## Selection Behavior

`useLyricsEditor.activateLine(lineId)` should compare the requested line with the current active line before changing state.

When the requested line is different from the current active line, it should set `activeLineId` to the new line and force `activeWordIndex` to `0`. This keeps the timing bar anchored on the start block whenever the user moves from one lyric line to another.

When the requested line is already active, it should keep the current `activeWordIndex`. This preserves intentional word selection if the user clicks the same lyric line again.

The existing line-level seek fallback remains: prefer the selected line's `startTime`, otherwise fall back to the previous line's last known word end time, then previous line `startTime`, and otherwise do not seek.

## WordSplitBar Seek Behavior

In timing mode, clicking a timing block should update selection and seek only when a meaningful time is available.

- Clicking the start block selects `activeWordIndex = 0` and seeks to `activeLine.startTime` if it is defined.
- Clicking a word block selects `activeWordIndex = wordIndex + 1`.
- The word seek target is the word's derived start time: the line `startTime` for the first word, or the previous word's `endTime` for later words.
- If the derived start time is unavailable, selection still changes but no seek is attempted.

This behavior should stay in the Vue/composable layer. Timing data is read from the active line, while actual seeking still goes through `store.seekPlayback()`.

## Interval Playback

The editor store should own interval playback state because it already owns playback, seek, pause, audio replacement, metronome pause handling, and the RAF playback loop.

Add a store-level interval stop target, conceptually `playbackStopAt: number | null`, plus a `playInterval(start, end)` action.

`playInterval(start, end)` should:

- require loaded audio;
- clamp both boundaries to the current duration;
- ignore invalid ranges where `end <= start`;
- clear any previous interval stop target;
- seek to the interval start without treating that internal seek as an external cancellation;
- set `playbackStopAt` to the clamped interval end;
- start playback if it is not already playing.

The RAF playback tick should check the interval stop target after reading the transport's current time. When `currentTime >= playbackStopAt`, it should pause audio, stop the RAF loop, set `currentTime` to the stop time, clear the interval stop target, and run the same metronome pause handling used by normal pause.

`useLyricsEditor.handlePlayLineInterval()` should compute the current line range from `line.startTime` to the last word's `endTime`, then call `store.playInterval(start, end)`.

`useLyricsEditor.handlePlayWordInterval()` should compute the selected word range from its derived start time to its own `endTime`, then call `store.playInterval(start, end)`. The start block is not a playable word interval.

## Cancellation Rules

Interval playback should be cancelled when the user or app does something that means "leave this audition range".

Clear the interval stop target when:

- the user toggles playback manually;
- `pausePlayback()` runs;
- a new audio file is imported;
- normal playback starts outside `playInterval()`;
- playback naturally stops because the transport is no longer playing;
- an external `seekPlayback()` happens while an interval stop target is active.

External seek cancellation has one important constraint: if no interval stop target is active, `seekPlayback()` must preserve current behavior and must not pause playback. This means playback can continue through normal timeline seeks unless the seek is cancelling an active interval playback.

`playInterval()` needs an internal seek path or option so its own seek to the interval start does not immediately cancel the new interval.

## Edge Cases

- A word `endTime` of `0` is valid. Use `endTime === undefined` checks rather than truthy checks.
- Missing line start time, missing word start time, missing word end time, or missing last word end time should leave the UI stable and avoid starting playback.
- Starting a new line/word interval while another interval is playing should replace the old interval and restart from the new start time.
- If an interval endpoint exceeds audio duration, clamp it to duration.
- If clamping makes the interval empty, do not start playback.
- No-audio behavior should continue to report through the existing status channel.

## Testing

Add or update tests around:

- activating a different line resets `activeWordIndex` to `0`;
- activating the same line preserves `activeWordIndex`;
- WordSplitBar timing block clicks seek to start or derived word start times;
- WordSplitBar clicks do not seek when the target time is unknown;
- line and word interval playback set a stop target and stop at the endpoint;
- manual pause, audio replacement, normal playback, and external seek cancel interval playback;
- external seek does not pause playback when no interval playback is active;
- zero-valued word end times are treated as defined.
- spectrogram plugin DOM is kept below wrapper-attached overlays and the viewport-fixed playhead.
