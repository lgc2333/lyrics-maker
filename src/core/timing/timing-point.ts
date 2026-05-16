import type { TimingPoint } from '../domain/project'

export function sortTimingPoints(points: readonly TimingPoint[]): TimingPoint[] {
  return [...points].sort((a, b) => a.time - b.time)
}

export function validateTimingPoint(point: TimingPoint): string[] {
  const errors: string[] = []

  if (point.bpm <= 0) {
    errors.push('bpm must be positive')
  }

  if (point.timeSignatureNumerator <= 0) {
    errors.push('timeSignatureNumerator must be positive')
  }

  if (point.timeSignatureDenominator <= 0) {
    errors.push('timeSignatureDenominator must be positive')
  }

  return errors
}
