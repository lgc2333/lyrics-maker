import { createI18n } from 'vue-i18n'

import enUS from './locales/en-US.json'
import zhCN from './locales/zh-CN.json'

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN'

export type LocaleMode = 'system' | SupportedLocale

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export function setI18nLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale)
  }
}

export function resolveActiveLocale(
  mode: LocaleMode,
  navigatorLanguages: readonly string[] = [],
): SupportedLocale {
  if (mode !== 'system') return mode
  for (const lang of navigatorLanguages) {
    const lower = lang.toLowerCase()
    if (lower.startsWith('zh')) return 'zh-CN'
    if (lower.startsWith('en')) return 'en-US'
  }
  return DEFAULT_LOCALE
}
