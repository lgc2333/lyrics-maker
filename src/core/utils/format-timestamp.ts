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
