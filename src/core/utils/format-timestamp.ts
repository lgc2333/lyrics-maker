export function formatTimestamp(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.000'
  const totalMs = Math.round(sec * 1000)
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const milliseconds = totalMs % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}
