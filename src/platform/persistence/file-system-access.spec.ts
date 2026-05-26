import { describe, expect, it } from 'vitest'

import {
  getPlatformFilePickerApi,
  getPlatformSavePickerApi,
  hasOpenFilePicker,
  hasSaveFilePicker,
} from './file-system-access'

describe('getPlatformSavePickerApi', () => {
  it('returns window as the platform save picker api', () => {
    const api = getPlatformSavePickerApi()
    expect(api).toBe(window)
  })
})

describe('getPlatformFilePickerApi', () => {
  it('returns window as the platform file picker api', () => {
    const api = getPlatformFilePickerApi()
    expect(api).toBe(window)
  })
})

describe('hasSaveFilePicker', () => {
  it('returns false in test environment (no showSaveFilePicker)', () => {
    const api = getPlatformSavePickerApi()
    expect(hasSaveFilePicker(api)).toBe(false)
  })
})

describe('hasOpenFilePicker', () => {
  it('returns false in test environment (no showOpenFilePicker)', () => {
    const api = getPlatformFilePickerApi()
    expect(hasOpenFilePicker(api)).toBe(false)
  })
})
