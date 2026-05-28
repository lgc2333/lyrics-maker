import { describe, expect, it } from 'vitest'

import { detectLyricsFileKind, getLyricsAdapter } from './registry'

describe('lyrics io registry', () => {
  it('detects content signatures before misleading extensions', () => {
    expect(
      detectLyricsFileKind('wrong.txt', 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx'),
    ).toEqual({
      kind: 'lyrics',
      format: 'vtt',
      displayFormat: 'vtt',
    })
  })

  it('detects project JSON files', () => {
    expect(detectLyricsFileKind('project.json', '{"version":1,"lyrics":[]}')).toEqual({
      kind: 'project',
    })
  })

  it('rejects known unsupported extensions instead of treating them as TXT', () => {
    expect(detectLyricsFileKind('song.mp3', 'not lyrics')).toEqual({
      kind: 'unsupported',
    })
  })

  it('registers all required adapters', () => {
    expect(getLyricsAdapter('txt').extension).toBe('txt')
    expect(getLyricsAdapter('lrc').extension).toBe('lrc')
    expect(getLyricsAdapter('ttml').extension).toBe('ttml')
    expect(getLyricsAdapter('ass').extension).toBe('ass')
    expect(getLyricsAdapter('srt').extension).toBe('srt')
    expect(getLyricsAdapter('vtt').extension).toBe('vtt')
  })

  it('detects ordinary LRC as line-level LRC for display', () => {
    expect(detectLyricsFileKind('song.lrc', '[00:01.000]hello')).toEqual({
      kind: 'lyrics',
      format: 'lrc',
      displayFormat: 'lrc-line',
      lrcFlavor: 'line',
    })
  })

  it('detects enhanced LRC for display', () => {
    expect(
      detectLyricsFileKind('song.lrc', '[00:01.000]<00:01.000>你<00:01.300>好'),
    ).toEqual({
      kind: 'lyrics',
      format: 'lrc',
      displayFormat: 'lrc-enhanced',
      lrcFlavor: 'enhanced',
    })
  })

  it('detects ESLyric for display', () => {
    expect(detectLyricsFileKind('song.lrc', '[00:01.000]你[00:01.300]好')).toEqual({
      kind: 'lyrics',
      format: 'lrc',
      displayFormat: 'lrc-eslyric',
      lrcFlavor: 'eslyric',
    })
  })

  it('does not misclassify repeated ordinary LRC line tags as ESLyric', () => {
    expect(detectLyricsFileKind('song.lrc', '[00:01.000][00:02.000]same line')).toEqual(
      {
        kind: 'lyrics',
        format: 'lrc',
        displayFormat: 'lrc-line',
        lrcFlavor: 'line',
      },
    )
  })
})
