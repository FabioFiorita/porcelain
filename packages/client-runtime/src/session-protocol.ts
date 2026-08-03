import { type ServerMessage, serverMessageSchema } from '@porcelain/contracts'

/** Initial reconnect delay after a dropped socket. */
export const MIN_RETRY_MS = 500
/** Cap on exponential backoff between reconnect attempts. */
export const MAX_RETRY_MS = 8_000
/** Default unary request timeout for request/reply frames on the session. */
export const REQUEST_TIMEOUT_MS = 10_000
/**
 * Daemon closes a live session with 4001 when the client token was revoked.
 * Other abnormal closes (1006) may mean network or 401 — probe, don't assume revoke.
 */
export const REVOKED_CLOSE_CODE = 4001

/** Build the session WebSocket URL from an HTTP(S) daemon origin. */
export function sessionWebSocketUrl(baseUrl: string): string {
  return `${baseUrl.replace(/^http/, 'ws')}/session`
}

/** Subprotocol carrying the bearer token (never a query string). */
export function sessionSubprotocol(token: string): string {
  return `porcelain.${token}`
}

/** Exponential backoff step, capped at `maxMs` (default MAX_RETRY_MS). */
export function nextRetryDelay(currentMs: number, maxMs: number = MAX_RETRY_MS): number {
  return Math.min(currentMs * 2, maxMs)
}

/** Jittered delay for a reconnect timer (0–30% of the base delay). */
export function reconnectDelayMs(baseMs: number, random = Math.random): number {
  return baseMs + random() * baseMs * 0.3
}

/** Parse and validate a daemon session frame; null if not a known ServerMessage. */
export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const json: unknown = JSON.parse(raw)
    const parsed = serverMessageSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Union file/dir watch registrations into unique path lists. */
export function unionWatchPaths(
  registrations: Iterable<{ files?: readonly string[]; dirs?: readonly string[] }>,
): { files: string[]; dirs: string[] } {
  const files = new Set<string>()
  const dirs = new Set<string>()
  for (const reg of registrations) {
    for (const path of reg.files ?? []) files.add(path)
    for (const path of reg.dirs ?? []) dirs.add(path)
  }
  return { files: [...files], dirs: [...dirs] }
}
