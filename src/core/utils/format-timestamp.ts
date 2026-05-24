// Upper bound: 99:59:59.999 (359999.999 seconds). Audio files don't exceed
// ~24 hours realistically; beyond this bound sec*1000 overflows to Infinity.
const MAX_FORMAT_SECONDS = 359999.999

export function formatTimestamp(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0 || sec > MAX_FORMAT_SECONDS) return '00:00.000'
  const totalMs = Math.round(sec * 1000)
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const milliseconds = totalMs % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

export function parseTimestamp(value: string): number | null {
  const text = value.trim()
  if (!text || text.startsWith('-')) return null

  const match = /^(\d+):([0-5]\d)(?:[.:](\d{1,3}))?$/.exec(text)
  if (!match) return null

  const minutes = Number.parseInt(match[1], 10)
  const seconds = Number.parseInt(match[2], 10)
  const milliseconds = Number.parseInt((match[3] ?? '0').padEnd(3, '0'), 10)
  const result = minutes * 60 + seconds + milliseconds / 1000

  return result <= MAX_FORMAT_SECONDS ? result : null
}
