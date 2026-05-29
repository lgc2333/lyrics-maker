import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

import { DEFAULT_LOCALE, i18n, setI18nLocale } from '../i18n'
import type { LocaleMode } from '../i18n'
import { useI18nSync } from './useI18nSync'

interface Harness {
  app: ReturnType<typeof createApp>
  localeMode: ReturnType<typeof ref<LocaleMode>>
}

function mount(navigatorLanguages: readonly string[] = []): Harness {
  const localeMode = ref<LocaleMode>('system')
  const TestHost = defineComponent({
    setup() {
      useI18nSync({ localeMode, navigatorLanguages })
      return () => h('div')
    },
  })
  const app = createApp(TestHost)
  app.mount(document.createElement('div'))
  return { app, localeMode }
}

let activeApp: ReturnType<typeof createApp> | null = null

beforeEach(() => {
  setI18nLocale(DEFAULT_LOCALE)
  document.title = ''
  document.documentElement.setAttribute('lang', '')
  const existing = document.querySelector('meta[name="description"]')
  existing?.remove()
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'description')
  meta.setAttribute('content', '')
  document.head.appendChild(meta)
})

afterEach(() => {
  activeApp?.unmount()
  activeApp = null
})

describe('useI18nSync', () => {
  it('resolves system mode to en-US when browser prefers English', async () => {
    const harness = mount(['en-US'])
    activeApp = harness.app
    await nextTick()

    expect(i18n.global.locale.value).toBe('en-US')
    expect(document.title).toBe('Lyrics Maker — Web-based Lyrics Timing Editor')
    expect(
      document.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toContain('Lyrics Maker is an open-source')
    expect(document.documentElement.getAttribute('lang')).toBe('en-US')
  })

  it('switches HTML head when localeMode changes to zh-CN', async () => {
    const harness = mount(['en-US'])
    activeApp = harness.app
    await nextTick()

    harness.localeMode.value = 'zh-CN'
    await nextTick()

    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(document.title).toContain('歌词打轴编辑器')
    expect(
      document.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toContain('开源的网页端歌词打轴编辑器')
    expect(document.documentElement.getAttribute('lang')).toBe('zh-CN')
  })

  it('falls back to default locale when system mode has no supported language', async () => {
    const harness = mount(['fr', 'ja'])
    activeApp = harness.app
    await nextTick()

    expect(i18n.global.locale.value).toBe(DEFAULT_LOCALE)
  })
})
