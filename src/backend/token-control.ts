import { createHash } from 'node:crypto'
import { closeAllSessions } from './session'
import { rotateDaemonToken } from './token-file'

/**
 * Live auth control for the one shared daemon token.
 *
 * The HTTP factory closes over a mutable hash (daemon-http `setTokenHash`); the entry
 * file binds that setter here at boot so API procedures can rotate without importing
 * the server.
 */

type HashSetter = (hash: Buffer) => void

let currentToken = ''
let setHash: HashSetter | null = null

/** Called once from server.ts after `createDaemonHttp` — token + the live hash setter. */
export function bindAuthToken(token: string, setter: HashSetter): void {
  currentToken = token
  setHash = setter
}

/** Current shared secret. Empty only before bind (nothing listens yet). */
export function currentAuthToken(): string {
  return currentToken
}

/**
 * Write a new token, swap the live hash, and drop every open session. Returns the
 * plaintext so the client that initiated Revoke all can keep talking (browser
 * localStorage / shell binding).
 */
export async function rotateAuthToken(): Promise<string> {
  const token = await rotateDaemonToken()
  currentToken = token
  setHash?.(createHash('sha256').update(token).digest())
  closeAllSessions()
  return token
}
