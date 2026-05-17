import { config } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { i18n } from '../platform/i18n'

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

const defaultStubs = {
  Icon: true,
}

config.global.plugins = [i18n]
config.global.stubs = { ...defaultStubs }

afterEach(() => {
  config.global.stubs = { ...defaultStubs }
})
