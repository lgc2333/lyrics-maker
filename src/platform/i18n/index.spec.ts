import { describe, expect, it } from 'vitest'

import { i18n } from './index'

describe('i18n', () => {
  it('loads zh-CN as default locale', () => {
    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(i18n.global.t('shell.menu.file')).toBe('文件')
  })
})
