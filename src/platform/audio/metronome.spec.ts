import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMetronome } from './metronome'

/**
 * Creates a fake AudioContext for testing metronome scheduling logic.
 * Tracks created oscillators and gain nodes for inspection.
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
  }

  return ctx
}

describe('metronome', () => {
  let fakeCtx: ReturnType<typeof createFakeAudioContext>

  beforeEach(() => {
    fakeCtx = createFakeAudioContext()
  })

  describe('scheduling', () => {
    it('schedules accent on bar start and normal clicks otherwise', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)

      // Schedule accent (bar start) at time 10.5
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      const accentOsc = fakeCtx._oscillators[0]
      expect(accentOsc.frequency.value).toBeGreaterThan(500)

      // Schedule normal click at time 11
      m.syncToTimeline(10.5, { at: 11, isBarStart: false })
      const normalOsc = fakeCtx._oscillators[1]
      expect(normalOsc.frequency.value).toBeLessThan(accentOsc.frequency.value)
    })

    it('schedules clicks at the correct audio context time', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)

      // currentTime = 10, nextBeat.at = 10.5 → scheduled at ctx.currentTime + 0.5 = 10.5
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      const osc = fakeCtx._oscillators[0]
      expect(osc.start).toHaveBeenCalledWith(10.5)
    })

    it('does not double-schedule the same beat', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      // Only 1 oscillator should be created (plus master gain)
      expect(fakeCtx._oscillators.length).toBe(1)
    })

    it('does nothing when nextBeat is null', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)

      m.syncToTimeline(10, null)

      // Master gain node is created, but no oscillator for click
      expect(fakeCtx._oscillators.length).toBe(0)
    })

    it('connects click chain: oscillator → clickGain → masterGain → destination', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      const clickGain = fakeCtx._gains[1] // [0] is master gain
      const masterGain = fakeCtx._gains[0]

      // Oscillator connects to click gain
      expect(fakeCtx._oscillators[0].connect).toHaveBeenCalledWith(clickGain)
      // Click gain connects to master gain
      expect(clickGain.connect).toHaveBeenCalledWith(masterGain)
      // Master gain connects to destination
      expect(masterGain.connect).toHaveBeenCalledWith(fakeCtx.destination)
    })
  })

  describe('latch policy', () => {
    it('on disable keeps current click, schedules one latch, then stops', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)

      // Disable: latch becomes pending
      m.setEnabled(false)
      expect(m.hasPendingLatch()).toBe(true)

      // syncToTimeline fires the latch
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      expect(m.hasPendingLatch()).toBe(false)

      // After latch, no more clicks are scheduled
      const oscCount = fakeCtx._oscillators.length
      m.syncToTimeline(10.5, { at: 11, isBarStart: false })
      expect(fakeCtx._oscillators.length).toBe(oscCount)
    })

    it('latch click is a real click (creates oscillator)', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)
      m.setEnabled(false)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      // Latch should have created an oscillator
      expect(fakeCtx._oscillators.length).toBe(1)
      expect(fakeCtx._oscillators[0].start).toHaveBeenCalled()
    })

    it('cancels pending latch if re-enabled before latch time', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)
      m.setEnabled(false)
      expect(m.hasPendingLatch()).toBe(true)

      m.setEnabled(true)
      expect(m.hasPendingLatch()).toBe(false)
    })

    it('after re-enabling, resumes normal scheduling', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)
      m.setEnabled(false)
      m.setEnabled(true)

      // Now should schedule normally again
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      expect(fakeCtx._oscillators.length).toBe(1)

      m.syncToTimeline(10.5, { at: 11, isBarStart: false })
      expect(fakeCtx._oscillators.length).toBe(2)
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

    it('latch only fires once even with multiple syncToTimeline calls', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)
      m.setEnabled(false)

      // First call fires latch
      m.syncToTimeline(10, { at: 10.5, isBarStart: true })
      expect(fakeCtx._oscillators.length).toBe(1)

      // Second call should not create another oscillator
      m.syncToTimeline(10.5, { at: 11, isBarStart: false })
      expect(fakeCtx._oscillators.length).toBe(1)
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

    it('sfx volume is independent from oscillator gain', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)
      m.setSfxVolume(0.3)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      const masterGain = fakeCtx._gains[0]
      expect(masterGain.gain.value).toBeCloseTo(0.3)

      // The per-click gain should still have its own value (accent/normal)
      const clickGain = fakeCtx._gains[1]
      expect(clickGain.gain.value).toBeGreaterThan(0)
    })
  })

  describe('enabled state', () => {
    it('does not schedule clicks when not enabled', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      // Not enabled by default

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      // No click oscillator should be created (only master gain)
      expect(fakeCtx._oscillators.length).toBe(0)
    })

    it('schedules clicks when enabled', () => {
      const m = createMetronome(fakeCtx as unknown as AudioContext)
      m.setEnabled(true)

      m.syncToTimeline(10, { at: 10.5, isBarStart: true })

      expect(fakeCtx._oscillators.length).toBe(1)
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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const fakeCtx = {
      currentTime: 0,
      destination: {} as AudioDestinationNode,
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
      createBufferSource: () => ({ buffer: null, connect: vi.fn(), start: vi.fn() }),
      decodeAudioData: vi.fn(async () => ({}) as unknown as AudioBuffer),
    } as unknown as AudioContext

    createMetronome(fakeCtx)
    await Promise.resolve()
    await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-tick-osu.wav')
    expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-tick-downbeat-osu.wav')
    expect(fetchMock).toHaveBeenCalledWith('/assets/metronome-latch-osu.wav')
    vi.unstubAllGlobals()
  })
})
