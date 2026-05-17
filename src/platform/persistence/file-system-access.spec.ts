import { describe, expect, it } from 'vitest'

import { getPlatformSavePickerApi, hasSaveFilePicker } from './file-system-access'

describe('getPlatformSavePickerApi', () => {
  it('returns window as the platform save picker api', () => {
    const api = getPlatformSavePickerApi()
    expect(api).toBe(window)
  })
})

describe('hasSaveFilePicker', () => {
  it('returns false in test environment (no showSaveFilePicker)', () => {
    const api = getPlatformSavePickerApi()
    expect(hasSaveFilePicker(api)).toBe(false)
  })
})
