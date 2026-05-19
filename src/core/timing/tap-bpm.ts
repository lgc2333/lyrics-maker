const GAP_RESET_THRESHOLD_SEC = 1.0 // Reset tap buffer if gap between taps exceeds 1 second
const NEGATIVE_TOLERANCE_SEC = 0.1 // Ignore small backward time jumps (noise tolerance)

export interface TapEstimate {
  bpm: number
  sampleCount: number
}

export function createTapBpmEstimator(maxSamples = 128): {
  push: (timestampSeconds: number) => TapEstimate | null
  reset: () => void
} {
  let buffer: number[] = []

  function push(timestampSeconds: number): TapEstimate | null {
    // If gap > GAP_RESET_THRESHOLD_SEC since last tap, or timestamp goes backwards > NEGATIVE_TOLERANCE_SEC, reset buffer
    if (buffer.length > 0) {
      const gap = timestampSeconds - buffer[buffer.length - 1]
      if (gap > GAP_RESET_THRESHOLD_SEC || gap < -NEGATIVE_TOLERANCE_SEC) {
        buffer = []
      }
    }

    // Add timestamp to buffer
    buffer.push(timestampSeconds)

    // Keep only last maxSamples
    if (buffer.length > maxSamples) {
      buffer = buffer.slice(buffer.length - maxSamples)
    }

    // Need at least 2 taps to calculate interval
    if (buffer.length < 2) {
      return null
    }

    // Need > 8 taps for a stable estimate
    if (buffer.length <= 8) {
      return null
    }

    // Calculate average interval from consecutive timestamp differences
    let totalInterval = 0
    for (let i = 1; i < buffer.length; i++) {
      totalInterval += buffer[i] - buffer[i - 1]
    }
    const avgInterval = totalInterval / (buffer.length - 1)

    // BPM = 60 seconds / average interval between taps
    const bpm = Math.round(60 / avgInterval)

    return { bpm, sampleCount: buffer.length }
  }

  function reset(): void {
    buffer = []
  }

  return { push, reset }
}
