/**
 * Resolve a user-typed assignment expression against the current value.
 *
 * Supported forms:
 *   +20    → current + 20
 *   -10    → current - 10
 *   =300   → 300
 *   300    → 300 (absolute)
 */
export function resolveExpression(input: string, current: number): number {
  const s = input.trim()
  if (s.startsWith('+')) {
    const n = parseFloat(s.slice(1))
    return isNaN(n) ? current : current + n
  }
  if (s.startsWith('-')) {
    const n = parseFloat(s.slice(1))
    return isNaN(n) ? current : current - n
  }
  if (s.startsWith('=')) {
    const n = parseFloat(s.slice(1))
    return isNaN(n) ? current : n
  }
  const n = parseFloat(s)
  return isNaN(n) ? current : n
}
