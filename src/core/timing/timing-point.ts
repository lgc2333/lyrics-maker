import zhCN from '../../platform/i18n/locales/zh-CN.json'
import type { TimingPoint } from '../domain/project'

export function sortTimingPoints(points: readonly TimingPoint[]): TimingPoint[] {
  return [...points].sort((a, b) => a.time - b.time)
}

export function validateTimingPoint(point: TimingPoint): string[] {
  const errors: string[] = []

  if (point.bpm <= 0) {
    errors.push(zhCN.errors.bpmMustBePositive)
  }

  if (point.timeSignatureNumerator <= 0) {
    errors.push(zhCN.errors.timeSignatureNumeratorMustBePositive)
  }

  if (point.timeSignatureDenominator <= 0) {
    errors.push(zhCN.errors.timeSignatureDenominatorMustBePositive)
  }

  return errors
}
