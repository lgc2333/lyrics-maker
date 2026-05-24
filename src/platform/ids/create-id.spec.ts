import { afterEach, describe, expect, it, vi } from 'vitest'

import { createId, createPrefixedId } from './create-id'

const originalCrypto = globalThis.crypto

function setCrypto(value: Crypto | undefined): void {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value,
  })
}

afterEach(() => {
  setCrypto(originalCrypto)
  vi.restoreAllMocks()
})

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => 'native-id')
    setCrypto({ randomUUID } as unknown as Crypto)

    expect(createId()).toBe('native-id')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    setCrypto({
      getRandomValues: vi.fn((bytes: Uint8Array) => {
        bytes.fill(1)
        return bytes
      }),
    } as unknown as Crypto)

    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('still creates unique IDs when Web Crypto is unavailable', () => {
    setCrypto(undefined)

    expect(createId()).not.toBe(createId())
  })
})

describe('createPrefixedId', () => {
  it('adds a stable prefix to generated IDs', () => {
    setCrypto({
      randomUUID: vi.fn(() => 'abc'),
    } as unknown as Crypto)

    expect(createPrefixedId('line')).toBe('line-abc')
  })
})
