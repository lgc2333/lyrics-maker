# Lyrics Import/Export Patterns

## Format Registry & Contracts

- **Lyrics export adapters receive the full `ProjectDocument`.** Even if an adapter currently only uses `project.lyrics`, keep the export contract project-shaped so future song metadata can flow into TXT/LRC/TTML/ASS/SRT/VTT serialization without another API break.
- **Lyrics import/export separates physical format, display format, and export target.** Keep `LyricsFormatId` for adapter lookup, use display format metadata for UI labels, and use export target ids for variants like ordinary LRC/enhanced LRC/ESLyric that share `.lrc`.

## LRC

- **LRC boundary timestamps are timing metadata, not lyric words.** Trailing inline timestamps and empty timestamp-only lines should become previous-line end boundaries when applicable, and should not create visible empty lyric lines or words unless the model explicitly needs a silence placeholder.

## TTML

- **AMLL TTML uses `@applemusic-like-lyrics/ttml`.** Do not hand-roll AMLL TTML parsing/serialization; in Node/Vitest inject `@xmldom/xmldom` DOMParser/DOMImplementation/XMLSerializer.
- **AMLL TTML dependency license is AGPL-3.0-only.** If project licensing/distribution changes, re-check whether `@applemusic-like-lyrics/ttml` remains acceptable.
- **AMLL TTML trailing spaces are text nodes, not flags.** `@applemusic-like-lyrics/ttml` serializes `endsWithSpace` as a literal space after the span; unformatted exports round-trip, but XML pretty-formatting can erase that semantic space.

## ASS / Subtitles

- **ASS structure parsing/serialization uses `ass-compiler`.** Use `parse()`/`stringify()` for ASS file structure; keep project-specific mapping limited to `Dialogue.Text.parsed` fragments and lyric word timing.
- **ASS karaoke timing maps from `k/K/kf/ko` tags.** Import karaoke durations from parsed tag objects into word `endTime`; export timed words as `{\\k...}` fragments in a `ParsedASS` object before `stringify()`.
