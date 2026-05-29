import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  i18n,
  resolveActiveLocale,
  setI18nLocale,
} from './index'

describe('i18n', () => {
  it('loads zh-CN as default locale', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN')
    expect(i18n.global.t('shell.menu.file')).toBe('文件')
  })

  it('exposes the supported locale set', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(['zh-CN', 'en-US'])
  })

  it('registers messages for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(i18n.global.availableLocales).toContain(locale)
    }
  })

  it('switches active locale via setI18nLocale', () => {
    setI18nLocale('en-US')
    expect(i18n.global.locale.value).toBe('en-US')
    expect(i18n.global.t('shell.menu.file')).toBe('File')
    setI18nLocale('zh-CN')
    expect(i18n.global.t('shell.menu.file')).toBe('文件')
  })
})

describe('resolveActiveLocale', () => {
  it('returns the explicit locale when mode is not system', () => {
    expect(resolveActiveLocale('zh-CN', ['en-US'])).toBe('zh-CN')
    expect(resolveActiveLocale('en-US', ['zh-CN'])).toBe('en-US')
  })

  it('matches the first supported language family in system mode', () => {
    expect(resolveActiveLocale('system', ['en-US', 'zh-CN'])).toBe('en-US')
    expect(resolveActiveLocale('system', ['zh-TW', 'en'])).toBe('zh-CN')
    expect(resolveActiveLocale('system', ['fr', 'en-GB'])).toBe('en-US')
  })

  it('falls back to the default locale when no language matches', () => {
    expect(resolveActiveLocale('system', [])).toBe(DEFAULT_LOCALE)
    expect(resolveActiveLocale('system', ['fr', 'ja'])).toBe(DEFAULT_LOCALE)
  })
})
