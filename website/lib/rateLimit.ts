const buckets = new Map<string, number[]>()

export function allow(key: string, limit: number, windowMs: number): boolean {
  if (!key || limit < 1 || windowMs < 1) return false
  const now = Date.now()
  const cutoff = now - windowMs
  const next = (buckets.get(key) ?? []).filter((t) => t > cutoff)
  if (next.length >= limit) {
    buckets.set(key, next)
    return false
  }
  next.push(now)
  buckets.set(key, next)
  return true
}
