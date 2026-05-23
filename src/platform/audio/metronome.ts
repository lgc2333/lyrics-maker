export interface MetronomeScheduler {
  setEnabled: (enabled: boolean) => void
  setSfxVolume: (volume: number) => void
  syncToTimeline: (
    currentTime: number,
    nextBeat: { at: number; isBarStart: boolean } | null,
  ) => void
  /**
   * Handles an upstream audio pause by cancelling future beat clicks and,
   * when the metronome was active, scheduling one latch at the next beat.
   */
  handlePlaybackPaused: (
    currentTime: number,
    nextBeat: { at: number; isBarStart: boolean } | null,
  ) => void
  cancelPendingClicks: () => void
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
 * - When playback pauses: replaces any future click with ONE latch click at next beat
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

  interface ScheduledClick {
    at: number
    kind: 'beat' | 'latch'
    source: AudioBufferSourceNode
  }

  const scheduledClicks: ScheduledClick[] = []

  function removeScheduledClick(click: ScheduledClick): void {
    const index = scheduledClicks.indexOf(click)
    if (index >= 0) scheduledClicks.splice(index, 1)
  }

  function cancelScheduledClicks(
    shouldCancel: (click: ScheduledClick) => boolean,
  ): void {
    for (const click of [...scheduledClicks]) {
      if (!shouldCancel(click)) continue
      try {
        click.source.stop()
      } catch {
        // The source may already have finished; in that case it is safe to ignore.
      }
      removeScheduledClick(click)
    }
  }

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
  function playBufferAt(
    at: number,
    buffer: AudioBuffer | null,
  ): AudioBufferSourceNode | null {
    if (destroyed || !buffer) return null
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(masterGain)
    source.start(at)
    return source
  }

  function trackScheduledClick(
    source: AudioBufferSourceNode,
    at: number,
    kind: ScheduledClick['kind'],
  ): void {
    const click: ScheduledClick = { at, kind, source }
    scheduledClicks.push(click)
    source.onended = () => removeScheduledClick(click)
  }

  function scheduleLatchAtNextBeat(
    currentTime: number,
    nextBeat: { at: number; isBarStart: boolean } | null,
  ): boolean {
    if (destroyed || !nextBeat || loadError || !latchBuffer) return false

    cancelScheduledClicks((click) => click.kind === 'beat' && click.at >= currentTime)

    const audioCtxTime = audioContext.currentTime + (nextBeat.at - currentTime)
    const source = playBufferAt(audioCtxTime, latchBuffer)
    if (!source) return false

    trackScheduledClick(source, nextBeat.at, 'latch')
    lastScheduledBeatTime = nextBeat.at
    latchPending = false
    return true
  }

  return {
    setEnabled(value: boolean) {
      if (value) {
        // Re-enabling: cancel any pending latch
        latchPending = false
        cancelScheduledClicks((click) => click.kind === 'latch')
        lastScheduledBeatTime = -1
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

      // Resume suspended AudioContext (browsers may suspend it on tab switch).
      // Only call resume() when actually suspended — state read is cheap,
      // avoiding the Promise allocation of resume() on every frame at 60fps.
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }

      // Reset tracking on large backward jumps (seek)
      if (nextBeat.at < lastScheduledBeatTime - 1) {
        lastScheduledBeatTime = -1
      }

      if (latchPending) {
        scheduleLatchAtNextBeat(currentTime, nextBeat)
        return
      }

      // Avoid double-scheduling the same beat.
      // Must run after backward-seek reset so earlier beats can be re-scheduled.
      if (nextBeat.at <= lastScheduledBeatTime) return

      if (loadError) return
      if (!tickBuffer || !downbeatBuffer || !latchBuffer) return

      const audioCtxTime = audioContext.currentTime + (nextBeat.at - currentTime)

      if (enabled) {
        const source = playBufferAt(
          audioCtxTime,
          nextBeat.isBarStart ? downbeatBuffer : tickBuffer,
        )
        if (!source) return
        trackScheduledClick(source, nextBeat.at, 'beat')
        lastScheduledBeatTime = nextBeat.at
      }
      // else: not enabled and no latch pending → do nothing
    },

    handlePlaybackPaused(
      currentTime: number,
      nextBeat: { at: number; isBarStart: boolean } | null,
    ): void {
      const shouldLatch = enabled || latchPending
      enabled = false

      if (!shouldLatch) {
        latchPending = false
        cancelScheduledClicks(
          (click) => click.kind === 'beat' && click.at >= currentTime,
        )
        return
      }

      latchPending = true
      scheduleLatchAtNextBeat(currentTime, nextBeat)
    },

    cancelPendingClicks(): void {
      latchPending = false
      cancelScheduledClicks(() => true)
      lastScheduledBeatTime = -1
    },

    fireLatchNow(): void {
      if (destroyed || !latchBuffer || !latchPending) return
      const source = playBufferAt(audioContext.currentTime + 0.05, latchBuffer)
      if (source) trackScheduledClick(source, audioContext.currentTime, 'latch')
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
      cancelScheduledClicks(() => true)
      masterGain.disconnect()
      audioContext.close()
    },
  }
}
