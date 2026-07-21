/**
 * Approximate context-window pressure for the Agent composer/session strip.
 * Providers report last-turn full input tokens; the human picks a window option
 * (`200k` / `1m`). This is an estimate — labeled with `~` in the UI.
 */

/** Parse opaque context-window option strings (`200k`, `1m`, `128000`) to token count. */
export function parseContextWindowTokens(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const raw = value.trim().toLowerCase()
  const match = /^(\d+(?:\.\d+)?)\s*(k|m)?$/.exec(raw)
  if (!match) return null
  const n = Number(match[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const unit = match[2]
  if (unit === 'k') return Math.round(n * 1000)
  if (unit === 'm') return Math.round(n * 1_000_000)
  return Math.round(n)
}

/** Percent of the selected window used by `usedTokens`, clamped 0–100. Null if unknown. */
export function estimateContextPercent(
  usedTokens: number | undefined,
  windowOption: string | undefined,
): number | null {
  if (usedTokens === undefined || usedTokens < 0) return null
  const window = parseContextWindowTokens(windowOption)
  if (window === null || window <= 0) return null
  return Math.min(100, Math.max(0, Math.round((usedTokens / window) * 100)))
}
