import { config } from '@vue/test-utils'
import { afterEach } from 'vitest'

afterEach(() => {
  config.global.stubs = {}
})
