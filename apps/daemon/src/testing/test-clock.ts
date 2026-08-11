/**
 * Deterministic clock for operation tests. Each `now()` returns a distinct
 * `Date` snapshot; `advance` rejects non-finite and negative deltas.
 */
export function createTestClock(initial: Date): {
  now(): Date
  advance(milliseconds: number): void
} {
  let currentMs = initial.getTime()

  return {
    now() {
      return new Date(currentMs)
    },
    advance(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new Error(
          `TestClock.advance requires a non-negative finite number; received ${String(milliseconds)}`,
        )
      }
      currentMs += milliseconds
    },
  }
}
