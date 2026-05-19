import type { TimingPoint } from '../domain/project'
import { TIMING_ERRORS } from './errors'

export function sortTimingPoints(points: readonly TimingPoint[]): TimingPoint[] {
  return [...points].sort((a, b) => a.time - b.time)
}

export function validateTimingPoint(point: Partial<TimingPoint>): string[] {
  const errors: string[] = []

  if (point.bpm !== undefined && (!Number.isFinite(point.bpm) || point.bpm <= 0)) {
    errors.push(TIMING_ERRORS.invalidBpm)
  }

  if (
    point.timeSignatureNumerator !== undefined &&
    (!Number.isFinite(point.timeSignatureNumerator) ||
      point.timeSignatureNumerator <= 0)
  ) {
    errors.push(TIMING_ERRORS.timeSignatureNumeratorMustBePositive)
  }

  if (
    point.timeSignatureDenominator !== undefined &&
    (!Number.isFinite(point.timeSignatureDenominator) ||
      point.timeSignatureDenominator <= 0)
  ) {
    errors.push(TIMING_ERRORS.timeSignatureDenominatorMustBePositive)
  }

  return errors
}
