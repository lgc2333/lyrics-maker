export interface MetronomeScheduler {
  setEnabled: (enabled: boolean) => void
  setSfxVolume: (volume: number) => void
  syncToTimeline: (
    currentTime: number,
    nextBeat: { at: number; isBarStart: boolean } | null,
  ) => void
  /**
   * Immediately schedules one latch click at audioContext.currentTime + 0.05s.
   *  No-op if latch is not pending or metronome is destroyed.
   */
  fireLatchNow: () => void
  hasPendingLatch: () => boolean
  getLoadError: () => Error | null
  destroy: () => void
}

/**
 * Creates a metronome scheduler that plays WAV samples via Web Audio API.
 *
 * Key behaviors:
 * - Bar start (downbeat): plays downbeat WAV sample
 * - Normal beat: plays tick WAV sample
 * - When disabled: lets current click finish, schedules ONE latch click at next beat, then stops
 * - If re-enabled before latch fires: cancels latch, resumes normal scheduling
 * - SFX volume controls metronome output independently from music volume
 */
export function createMetronome(audioContext: AudioContext): MetronomeScheduler {
  let enabled = false
  let latchPending = false
  let lastScheduledBeatTime = -1
  let destroyed = false

  let tickBuffer: AudioBuffer | null = null
  let downbeatBuffer: AudioBuffer | null = null
  let latchBuffer: AudioBuffer | null = null
  let loadError: Error | null = null

  async function loadBuffer(path: string): Promise<AudioBuffer> {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`Failed to fetch ${path}`)
    const raw = await response.arrayBuffer()
    return await audioContext.decodeAudioData(raw)
  }

  void Promise.all([
    loadBuffer('/assets/metronome-tick-osu.wav').then((b) => (tickBuffer = b)),
    loadBuffer('/assets/metronome-tick-downbeat-osu.wav').then(
      (b) => (downbeatBuffer = b),
    ),
    loadBuffer('/assets/metronome-latch-osu.wav').then((b) => (latchBuffer = b)),
  ]).catch((err) => {
    loadError = err instanceof Error ? err : new Error(String(err))
  })

  // Master gain node for SFX volume control
  const masterGain = audioContext.createGain()
  masterGain.gain.value = 0.8
  masterGain.connect(audioContext.destination)

  /**
   * Schedules a WAV buffer to play at the given AudioContext time.
   */
  function playBufferAt(at: number, buffer: AudioBuffer | null): void {
    if (destroyed || !buffer) return
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(masterGain)
    source.start(at)
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

      // Ensure AudioContext is running (browsers may suspend it)
      audioContext.resume()

      // Reset tracking on large backward jumps (seek)
      if (nextBeat.at < lastScheduledBeatTime - 1) {
        lastScheduledBeatTime = -1
      }

      // Avoid double-scheduling the same beat.
      // Must run after backward-seek reset so earlier beats can be re-scheduled.
      if (nextBeat.at <= lastScheduledBeatTime) return

      if (loadError) return
      if (!tickBuffer || !downbeatBuffer || !latchBuffer) return

      const audioCtxTime = audioContext.currentTime + (nextBeat.at - currentTime)

      if (enabled) {
        playBufferAt(audioCtxTime, nextBeat.isBarStart ? downbeatBuffer : tickBuffer)
        lastScheduledBeatTime = nextBeat.at
      } else if (latchPending) {
        playBufferAt(audioCtxTime, latchBuffer)
        lastScheduledBeatTime = nextBeat.at
        latchPending = false
      }
      // else: not enabled and no latch pending → do nothing
    },

    fireLatchNow(): void {
      if (destroyed || !latchBuffer || !latchPending) return
      playBufferAt(audioContext.currentTime + 0.05, latchBuffer)
      latchPending = false
    },

    hasPendingLatch(): boolean {
      return latchPending
    },

    getLoadError(): Error | null {
      return loadError
    },

    destroy(): void {
      destroyed = true
      masterGain.disconnect()
      audioContext.close()
    },
  }
}
