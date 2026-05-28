function roundMs(seconds: number): number {
  return Math.round(seconds * 1000)
}

function parseFraction(value: string | undefined): number {
  if (!value) return 0
  return Number.parseInt(value.padEnd(3, '0').slice(0, 3), 10) / 1000
}

export function parseLrcTime(value: string): number | null {
  const match = /^(\d+):([0-5]\d)(?:[.:](\d{1,3}))?$/.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2]) + parseFraction(match[3])
}

export function formatLrcTime(seconds: number): string {
  const totalMs = roundMs(Math.max(0, seconds))
  const minutes = Math.floor(totalMs / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `[${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}]`
}

export function parseSubtitleTime(value: string): number | null {
  const match = /^(\d+):([0-5]\d):([0-5]\d)(?:[,.](\d{1,3}))?$/.exec(value.trim())
  if (!match) return null
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    parseFraction(match[4])
  )
}

export function formatSubtitleTime(seconds: number, separator: ',' | '.'): string {
  const totalMs = roundMs(Math.max(0, seconds))
  const hours = Math.floor(totalMs / 3600000)
  const minutes = Math.floor((totalMs % 3600000) / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(ms).padStart(3, '0')}`
}

export function parseAssTime(value: string): number | null {
  const match = /^(\d+):([0-5]\d):([0-5]\d)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number.parseInt((match[4] ?? '0').padEnd(2, '0'), 10) / 100
  )
}

export function formatAssTime(seconds: number): string {
  const totalCs = Math.round(Math.max(0, seconds) * 100)
  const hours = Math.floor(totalCs / 360000)
  const minutes = Math.floor((totalCs % 360000) / 6000)
  const secs = Math.floor((totalCs % 6000) / 100)
  const cs = totalCs % 100
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function parseTtmlTime(value: string): number | null {
  const text = value.trim()
  const clock = parseSubtitleTime(text)
  if (clock !== null) return clock
  const offset = /^(\d+(?:\.\d+)?)(ms|s)$/i.exec(text)
  if (!offset) return null
  const amount = Number(offset[1])
  return offset[2].toLowerCase() === 'ms' ? amount / 1000 : amount
}

export function formatTtmlTime(seconds: number): string {
  return formatSubtitleTime(seconds, '.')
}
