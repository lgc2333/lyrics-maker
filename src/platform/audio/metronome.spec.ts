import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMetronome } from './metronome'

/**
 * Creates a fake AudioContext for testing metronome scheduling logic.
 * Tracks created oscillators, gain nodes, and buffer sources for inspection.
 */
function createFakeAudioContext() {
  const oscillators: Array<{
    type: OscillatorType
    frequency: { value: number }
    connect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }> = []

  const gains: Array<{
    gain: { value: number }
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }> = []

  const sources: Array<{
    buffer: AudioBuffer | null
    connect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
  }> = []

  const ctx = {
    currentTime: 10,
    destination: {} as AudioDestinationNode,

    createOscillator() {
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: { value: 440 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }
      oscillators.push(osc)
      return osc
    },

    createBufferSource() {
      const source = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn(),
      }
      sources.push(source)
      return source
    },

    decodeAudioData: vi.fn(async () => ({}) as unknown as AudioBuffer),

    createGain() {
      const gain = {
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      gains.push(gain)
      return gain
    },

    /** Access created oscillators for assertions */
    _oscillators: oscillators,
    /** Access created gain nodes for assertions */
    _gains: gains,
    /** Access created buffer sources for assertions */
    _sources: sources,
  }

  return ctx
}

describe('metronome', () => {
  let fakeCtx: ReturnType<typeof createFakeAudioContext>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }))
    vi.stubGlobal('fetch', fetchMock)
    fakeCtx = createFakeAudioContext()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * Flush the microtask queue enough times for all three WAV buffers
   * to finish loading (fetch -> arrayBuffer -> decodeAudioData).
   */
  async function flushMicrotasks() {
    // Each loadBuffer has 3 async steps, so flush multiple times to be safe
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  describe('scheduling', () => {
    it('schedules clicks for bar start and normal beats', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)

      // Schedule accent (bar start) at time 10.5
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      expect(fakeCtx._sources.length).toBe(1)
      expect(fakeCtx._sources[0].start).toHaveBeenCalled()

      // Schedule normal click at time 11
      m.syncToTimeline(10.5, { at: 11, isBarStart: false })
      expect(fakeCtx._sources.length).toBe(2)
      expect(fakeCtx._sources[1].start).toHaveBeenCalled()
    })

    it('schedules clicks at the correct audio context time', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)

      // currentTime = 10, nextBeat.at = 10.5 → scheduled at ctx.currentTime + 0.5 = 10.5
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      const source = fakeCtx._sources[0]
      expect(source.start).toHaveBeenCalledWith(10.5)
    })

    it('does not double-schedule the same beat', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      // Only 1 source should be created
      expect(fakeCtx._sources.length).toBe(1)
    })

    it('reschedules immediately after a backward timeline jump', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)

      // First schedule at a later position.
      m.syncToTimeline(30, { at: 30.5, isBarStart: true })
      expect(fakeCtx._sources.length).toBe(1)

      // Simulate seeking backward: the next beat is now earlier.
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      expect(fakeCtx._sources.length).toBe(2)
      expect(fakeCtx._sources[1].start).toHaveBeenCalledWith(10.5)
    })

    it('does nothing when nextBeat is null', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)

      m.syncToTimeline(10, null)

      // Master gain node is created, but no source for click
      expect(fakeCtx._sources.length).toBe(0)
    })

    it('connects source directly to master gain', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      const masterGain = fakeCtx._gains[0]

      // BufferSource connects to master gain
      expect(fakeCtx._sources[0].connect).toHaveBeenCalledWith(masterGain)
      // Master gain connects to destination
      expect(masterGain.connect).toHaveBeenCalledWith(fakeCtx.destination)
    })
  })

  describe('latch policy', () => {
    it('on disable keeps current click, schedules one latch, then stops', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)

      // Disable: latch becomes pending
      m.setEnabled(false)
      expect(m.hasPendingLatch()).toBe(true)

      // syncToTimeline fires the latch
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      expect(m.hasPendingLatch()).toBe(false)

      // After latch, no more clicks are scheduled
      const sourceCount = fakeCtx._sources.length
      m.syncToTimeline(10.5, { at: 11, isBarStart: false })
      expect(fakeCtx._sources.length).toBe(sourceCount)
    })

    it('latch click creates a source and schedules it', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)
      m.setEnabled(false)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      // Latch should have created a source
      expect(fakeCtx._sources.length).toBe(1)
      expect(fakeCtx._sources[0].start).toHaveBeenCalled()
    })

    it('cancels pending latch if re-enabled before latch time', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)
      m.setEnabled(false)
      expect(m.hasPendingLatch()).toBe(true)

      m.setEnabled(true)
      expect(m.hasPendingLatch()).toBe(false)
    })

    it('after re-enabling, resumes normal scheduling', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)
      m.setEnabled(false)
      m.setEnabled(true)

      // Now should schedule normally again
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      expect(fakeCtx._sources.length).toBe(1)

      m.syncToTimeline(10.5, { at: 11, isBarStart: false })
      expect(fakeCtx._sources.length).toBe(2)
    })

    it('setEnabled(false) when already disabled does not create another latch', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)
      m.setEnabled(false)
      expect(m.hasPendingLatch()).toBe(true)

      // Calling again when already disabled should not change state
      m.setEnabled(false)
      expect(m.hasPendingLatch()).toBe(true)
    })

    it('latch only fires once even with multiple syncToTimeline calls', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)
      m.setEnabled(false)

      // First call fires latch
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      expect(fakeCtx._sources.length).toBe(1)

      // Second call should not create another source
      m.syncToTimeline(10.5, { at: 11, isBarStart: false })
      expect(fakeCtx._sources.length).toBe(1)
    })
  })

  describe('sfx volume', () => {
    it('setSfxVolume applies to master gain', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setSfxVolume(0.5)

      const masterGain = fakeCtx._gains[0]
      expect(masterGain.gain.value).toBeCloseTo(0.5)
    })

    it('default sfx volume is 0.8', () => {
      createMetronome(fakeCtx as unknown as AudioContext)

      const masterGain = fakeCtx._gains[0]
      expect(masterGain.gain.value).toBeCloseTo(0.8)
    })

    it('clamps sfx volume to [0, 1]', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)

      m.setSfxVolume(1.5)
      expect(fakeCtx._gains[0].gain.value).toBe(1)

      m.setSfxVolume(-0.3)
      expect(fakeCtx._gains[0].gain.value).toBe(0)
    })

    it('sfx volume is applied to metronome output', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)
      m.setSfxVolume(0.3)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      const masterGain = fakeCtx._gains[0]
      expect(masterGain.gain.value).toBeCloseTo(0.3)

      // A source should be scheduled
      expect(fakeCtx._sources.length).toBe(1)
    })
  })

  describe('enabled state', () => {
    it('does not schedule clicks when not enabled', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      // Not enabled by default

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      // No source should be created (only master gain)
      expect(fakeCtx._sources.length).toBe(0)
    })

    it('schedules clicks when enabled', async () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      await flushMicrotasks()
      m.setEnabled(true)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      expect(fakeCtx._sources.length).toBe(1)
    })
  })

  describe('destroy', () => {
    it('disconnects master gain on destroy', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.destroy()

      // Master gain should be disconnected
      expect(fakeCtx._gains[0].disconnect).toHaveBeenCalled()
    })

    it('does not throw when syncToTimeline is called after destroy', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.destroy()

      // Should not throw
      expect(() => {
        m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      }).not.toThrow()
    })
  })

  // --- Regression: WAV sample loading ---
  it('loads three wav samples from /assets', async () => {
    createMetronome(fakeCtx as unknown as AudioContext)
    await flushMicrotasks()

    expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-tick-osu.wav')
    expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-tick-downbeat-osu.wav')
    expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-latch-osu.wav')
  })
})
