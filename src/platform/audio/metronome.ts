export interface MetronomeScheduler {
  setEnabled: (enabled: boolean) => void
  setSfxVolume: (volume: number) => void
  syncToTimeline: (
    currentTime: number,
    nextBeat: { at: number; isBarStart: boolean } | null,
  ) => void
  hasPendingLatch: () => boolean
  destroy: () => void
}

/**
 * Creates a metronome scheduler that generates click sounds via Web Audio API.
 *
 * Key behaviors:
 * - Accent click (bar start): higher frequency and louder
 * - Normal click: softer
 * - When disabled: lets current click finish, schedules ONE latch click at next beat, then stops
 * - If re-enabled before latch fires: cancels latch, resumes normal scheduling
 * - SFX volume controls metronome output independently from music volume
 */
export function createMetronome(audioContext: AudioContext): MetronomeScheduler {
  let enabled = false
  let latchPending = false
  let lastScheduledBeatTime = -1
  let destroyed = false

  // Master gain node for SFX volume control
  const masterGain = audioContext.createGain()
  masterGain.gain.value = 0.8
  masterGain.connect(audioContext.destination)

  /**
   * Schedules a click sound at the given AudioContext time.
   * Returns the created oscillator and per-click gain node.
   */
  function scheduleClick(at: number, isAccent: boolean) {
    if (destroyed) return

    const osc = audioContext.createOscillator()
    const clickGain = audioContext.createGain()

    // Accent: higher frequency (1760 Hz) and higher gain (0.7)
    // Normal: standard frequency (880 Hz) and lower gain (0.4)
    osc.type = 'sine'
    osc.frequency.value = isAccent ? 1760 : 880
    clickGain.gain.value = isAccent ? 0.7 : 0.4

    osc.connect(clickGain)
    clickGain.connect(masterGain)

    // Short click: 50ms duration
    osc.start(at)
    osc.stop(at + 0.05)
  }

  return {
    setEnabled(value: boolean) {
      if (value) {
        // Re-enabling: cancel any pending latch
        latchPending = false
      } else if (enabled) {
        // Disabling while enabled: schedule a latch
        latchPending = true
      }
      enabled = value
    },

    setSfxVolume(volume: number) {
      const clamped = Math.max(0, Math.min(1, volume))
      masterGain.gain.value = clamped
    },

    syncToTimeline(
      currentTime: number,
      nextBeat: { at: number; isBarStart: boolean } | null,
    ) {
      if (destroyed || !nextBeat) return

      // Avoid double-scheduling the same beat
      if (nextBeat.at <= lastScheduledBeatTime) return

      // Reset tracking on large backward jumps (seek)
      if (nextBeat.at < lastScheduledBeatTime - 1) {
        lastScheduledBeatTime = -1
      }

      if (enabled) {
        // Normal scheduling: play click at the beat time
        const audioCtxTime = audioContext.currentTime + (nextBeat.at - currentTime)
        scheduleClick(audioCtxTime, nextBeat.isBarStart)
        lastScheduledBeatTime = nextBeat.at
      } else if (latchPending) {
        // Latch: schedule one final click then stop
        const audioCtxTime = audioContext.currentTime + (nextBeat.at - currentTime)
        scheduleClick(audioCtxTime, nextBeat.isBarStart)
        lastScheduledBeatTime = nextBeat.at
        latchPending = false
      }
      // else: not enabled and no latch pending → do nothing
    },

    hasPendingLatch(): boolean {
      return latchPending
    },

    destroy(): void {
      destroyed = true
      masterGain.disconnect()
    },
  }
}
