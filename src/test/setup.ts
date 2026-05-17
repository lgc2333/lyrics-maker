import { config } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'

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

config.global.stubs = { ...defaultStubs }

afterEach(() => {
  config.global.stubs = { ...defaultStubs }
})
