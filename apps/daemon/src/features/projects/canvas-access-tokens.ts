import { randomBytes } from 'node:crypto'

/**
 * Short-lived, Canvas-scoped capability tokens for the authenticated
 * `GET /canvas/<token>` route (canvas-http.ts). NOT the admin credential or a
 * paired-client token (access-store.ts) — a plain browser iframe navigation
 * carries no Authorization header, so the URL itself is the only channel, and
 * this token is deliberately narrow: one Project+Canvas, in-memory only, a
 * few minutes' TTL. Losing it costs nothing the tRPC `readCanvas` procedure
 * doesn't already expose to the same authenticated caller.
 */

const CANVAS_TOKEN_TTL_MS = 5 * 60 * 1000
const CANVAS_TOKEN_BYTES = 24

type CanvasAccessGrant = Readonly<{
  projectId: string
  canvasId: string
  worktreePath: string | null
  expiresAt: number
}>

/**
 * `worktreePath` is part of the grant, not a lookup the route redoes: the token
 * must resolve to the exact Canvas the Viewer asked for, and a promoted Canvas
 * and a private one can share an id. Null means "private store only".
 */
export type CanvasAccessScope = Readonly<{
  projectId: string
  canvasId: string
  worktreePath: string | null
}>

export type CanvasAccessTokens = Readonly<{
  mint: (scope: CanvasAccessScope, now?: number) => string
  resolve: (token: string, now?: number) => CanvasAccessScope | null
}>

export function createCanvasAccessTokens(): CanvasAccessTokens {
  const grants = new Map<string, CanvasAccessGrant>()

  function sweep(now: number): void {
    for (const [token, grant] of grants) {
      if (grant.expiresAt <= now) grants.delete(token)
    }
  }

  return Object.freeze({
    mint(scope, now = Date.now()): string {
      sweep(now)
      const token = randomBytes(CANVAS_TOKEN_BYTES).toString('hex')
      grants.set(token, { ...scope, expiresAt: now + CANVAS_TOKEN_TTL_MS })
      return token
    },

    resolve(token, now = Date.now()): CanvasAccessScope | null {
      const grant = grants.get(token)
      if (grant === undefined) return null
      if (grant.expiresAt <= now) {
        grants.delete(token)
        return null
      }
      return {
        projectId: grant.projectId,
        canvasId: grant.canvasId,
        worktreePath: grant.worktreePath,
      }
    },
  })
}
