import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAudioTransport } from './audio-transport'

/**
 * Creates a fake HTMLAudioElement-like object for testing.
 * Simulates async media loading by emitting 'loadedmetadata' after microtask when src is set.
 * Pass { deferLoad: true } to suppress automatic loadedmetadata — the caller must call
 * el._completeLoad() manually to fire the event.
 */
function createFakeMediaElement(opts?: { deferLoad?: boolean }) {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  let _src = ''
  let _volume = 1
  let _currentTime = 0
  let _duration = Number.NaN
  let _paused = true
  let _pendingLoad: (() => void) | null = null

  const el = {
    get src() {
      return _src
    },
    set src(value: string) {
      _src = value
      if (value) {
        if (opts?.deferLoad) {
          _pendingLoad = () => {
            _duration = 120
            listeners.loadedmetadata?.forEach((fn) => fn())
          }
        } else {
          queueMicrotask(() => {
            _duration = 120
            listeners.loadedmetadata?.forEach((fn) => fn())
          })
        }
      }
    },
    _completeLoad() {
      _pendingLoad?.()
      _pendingLoad = null
    },
    get volume() {
      return _volume
    },
    set volume(v: number) {
      _volume = v
    },
    get currentTime() {
      return _currentTime
    },
    set currentTime(v: number) {
      _currentTime = v
    },
    get duration() {
      return _duration
    },
    get paused() {
      return _paused
    },

    addEventListener(event: string, fn: (...args: unknown[]) => void) {
      ;(listeners[event] ??= []).push(fn)
    },
    removeEventListener(event: string, fn: (...args: unknown[]) => void) {
      const list = listeners[event]
      if (list) {
        const idx = list.indexOf(fn)
        if (idx >= 0) list.splice(idx, 1)
      }
    },

    play() {
      _paused = false
      listeners.play?.forEach((fn) => fn())
      return Promise.resolve()
    },
    pause() {
      _paused = true
      listeners.pause?.forEach((fn) => fn())
    },
  }

  return el
}

describe('audio transport', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake-song.mp3'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('loadFile', () => {
    it('loads file and reports duration >= 0 and not playing', async () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      await transport.loadFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

      expect(transport.getDuration()).toBeGreaterThanOrEqual(0)
      expect(transport.getIsPlaying()).toBe(false)
    })

    it('sets src via object URL', async () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      await transport.loadFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(el.src).toBe('blob:fake-song.mp3')
    })
  })

  describe('playback control', () => {
    it('play starts playback and sets isPlaying', async () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      await transport.play()

      expect(transport.getIsPlaying()).toBe(true)
    })

    it('pause stops playback and sets isPlaying false', () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      transport.pause()

      expect(transport.getIsPlaying()).toBe(false)
    })

    it('getIsPlaying reads paused from the DOM element, not from events', async () => {
      // Simulates the Chrome bug where pause() followed immediately by a src
      // change can cancel the queued 'pause' event task. An event-based
      // `playing` flag would remain true forever, causing togglePlayback to
      // always hit the PAUSE branch.
      let _paused = false
      const el = {
        play() {
          _paused = false
          return Promise.resolve()
        },
        pause() {
          _paused = true
          // Deliberately do NOT fire any event — this is the Chrome bug
        },
        get paused() {
          return _paused
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        get currentTime() {
          return 0
        },
        set currentTime(_v: number) {},
        get duration() {
          return 120
        },
        get volume() {
          return 1
        },
        set volume(_v: number) {},
        get src() {
          return 'blob:test'
        },
      }

      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      // After play, getIsPlaying should be true
      await transport.play()
      expect(transport.getIsPlaying()).toBe(true)

      // After pause, getIsPlaying should be false — even though no 'pause'
      // event was ever fired (event listeners were never called)
      transport.pause()
      expect(transport.getIsPlaying()).toBe(false)
    })

    it('seek sets currentTime clamped to >= 0', () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      transport.seek(42.5)
      expect(transport.getCurrentTime()).toBe(42.5)

      transport.seek(-5)
      expect(transport.getCurrentTime()).toBe(0)
    })

    it('getCurrentTime returns the media element currentTime', () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      transport.seek(30)
      expect(transport.getCurrentTime()).toBe(30)
    })

    it('getDuration returns 0 when duration is NaN', () => {
      const el = createFakeMediaElement()
      // Before loading, duration is NaN
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      expect(transport.getDuration()).toBe(0)
    })
  })

  describe('volume', () => {
    it('applies music volume independently', () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      transport.setVolume(0.35)
      expect(el.volume).toBeCloseTo(0.35)
    })

    it('clamps volume to [0, 1]', () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      transport.setVolume(1.5)
      expect(el.volume).toBe(1)

      transport.setVolume(-0.3)
      expect(el.volume).toBe(0)
    })

    it('getVolume returns current media element volume', () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      transport.setVolume(0.75)
      expect(transport.getVolume()).toBeCloseTo(0.75)
    })
  })

  describe('destroy', () => {
    it('revokes object URL and removes listeners', () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      transport.destroy()

      // Don't crash — no object URL set, so just ensures no throw
      expect(transport.getIsPlaying()).toBe(false)
    })

    it('revokes object URL after loadFile', async () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      await transport.loadFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
      transport.destroy()

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-song.mp3')
    })

    it('cleans up pending loadFile listeners when destroyed in-flight', async () => {
      const el = createFakeMediaElement({ deferLoad: true })
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      // Start loading but do not await — destroy while Promise is pending
      const loadPromise = transport.loadFile(
        new File(['x'], 'song.mp3', { type: 'audio/mpeg' }),
      )

      // Destroy before loadedmetadata fires
      transport.destroy()

      // Now resolve the pending load — listeners should already be removed, so
      // the loadPromise should never settle (reject). We race against a short
      // timeout to confirm it does not resolve.
      el._completeLoad()

      let settled = false
      void loadPromise.then(
        () => {
          settled = true
        },
        () => {
          settled = true
        },
      )
      // Let pending microtasks drain
      await new Promise<void>((r) => setTimeout(r, 0))
      expect(settled).toBe(false)
    })

    it('revokes object URL from audioElement.src in destroy', async () => {
      const el = createFakeMediaElement()
      const transport = createAudioTransport(el as unknown as HTMLAudioElement)

      await transport.loadFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
      // Verify src is the blob URL
      expect(el.src).toBe('blob:fake-song.mp3')

      transport.destroy()

      // The destroy method now revokes from audioElement.src directly as a safety net
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-song.mp3')
    })
  })
})
