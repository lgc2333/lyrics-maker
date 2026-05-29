import { computed, watchEffect } from 'vue'
import type { Ref } from 'vue'

import { i18n, resolveActiveLocale, setI18nLocale } from '../i18n'
import type { LocaleMode } from '../i18n'

export interface UseI18nSyncOptions {
  localeMode: Ref<LocaleMode>
  navigatorLanguages?: readonly string[]
}

function setMetaDescription(content: string): void {
  if (typeof document === 'undefined') return
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'description')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

export function useI18nSync(options: UseI18nSyncOptions) {
  const activeLocale = computed(() =>
    resolveActiveLocale(options.localeMode.value, options.navigatorLanguages ?? []),
  )

  watchEffect(() => {
    setI18nLocale(activeLocale.value)
    if (typeof document !== 'undefined') {
      document.title = i18n.global.t('seo.title')
      setMetaDescription(i18n.global.t('seo.description'))
    }
  })

  return {
    activeLocale,
  }
}
