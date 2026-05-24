let fallbackCounter = 0

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0')
}

function bytesToUuid(bytes: Uint8Array): string {
  return [
    [...bytes.slice(0, 4)].map(toHex).join(''),
    [...bytes.slice(4, 6)].map(toHex).join(''),
    [...bytes.slice(6, 8)].map(toHex).join(''),
    [...bytes.slice(8, 10)].map(toHex).join(''),
    [...bytes.slice(10, 16)].map(toHex).join(''),
  ].join('-')
}

export function createId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return bytesToUuid(bytes)
  }

  fallbackCounter += 1
  return [
    'fallback',
    Date.now().toString(36),
    fallbackCounter.toString(36),
    Math.random().toString(36).slice(2),
  ].join('-')
}

export function createPrefixedId(prefix: string): string {
  return `${prefix}-${createId()}`
}
