import { config } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { DEFAULT_LOCALE, i18n, setI18nLocale } from '../i18n'

vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({
    name: 'Icon',
    props: {
      icon: {
        type: String,
        required: false,
      },
    },
    setup(props) {
      return () =>
        h('span', {
          'data-testid': 'icon-stub',
          'data-icon': props.icon ?? '',
        })
    },
  }),
}))

// Force navigator.languages to the project default locale so AppShell tests stay
// language-stable regardless of the host runner (happy-dom defaults to en-US).
Object.defineProperty(window.navigator, 'languages', {
  configurable: true,
  get: () => [DEFAULT_LOCALE],
})
Object.defineProperty(window.navigator, 'language', {
  configurable: true,
  get: () => DEFAULT_LOCALE,
})

const defaultStubs = {
  Icon: true,
}

config.global.plugins = [i18n]
config.global.stubs = { ...defaultStubs }

afterEach(() => {
  config.global.stubs = { ...defaultStubs }
  setI18nLocale(DEFAULT_LOCALE)
})
