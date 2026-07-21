/** 83000 → "1:23". Negative or NaN input clamps to 0:00. */
export function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Remaining time as "-M:SS", clamped at -0:00. */
export function formatRemaining(durationMs: number, positionMs: number): string {
  return `-${formatTime(durationMs - positionMs)}`
}
