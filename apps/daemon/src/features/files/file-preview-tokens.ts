import { randomBytes } from 'node:crypto'

/**
 * Short-lived, file-scoped capability tokens for the `GET /file-preview/<token>`
 * route (file-preview-http.ts). Same shape and rationale as the Canvas grants
 * (canvas-access-tokens.ts): a plain browser iframe navigation carries no
 * Authorization header, so the URL itself is the only channel, and the grant is
 * deliberately narrow — one project + one project-relative path, in memory only,
 * a few minutes' TTL. Losing it costs nothing the tRPC `previewHtml` procedure
 * does not already hand the same authenticated caller.
 */

const FILE_PREVIEW_TOKEN_TTL_MS = 5 * 60 * 1000
const FILE_PREVIEW_TOKEN_BYTES = 24

export type FilePreviewAccessScope = Readonly<{
  projectPath: string
  path: string
}>

type FilePreviewAccessGrant = FilePreviewAccessScope & Readonly<{ expiresAt: number }>

export type FilePreviewTokens = Readonly<{
  mint: (scope: FilePreviewAccessScope, now?: number) => string
  resolve: (token: string, now?: number) => FilePreviewAccessScope | null
}>

export function createFilePreviewTokens(): FilePreviewTokens {
  const grants = new Map<string, FilePreviewAccessGrant>()

  function sweep(now: number): void {
    for (const [token, grant] of grants) {
      if (grant.expiresAt <= now) grants.delete(token)
    }
  }

  return Object.freeze({
    mint(scope, now = Date.now()): string {
      sweep(now)
      const token = randomBytes(FILE_PREVIEW_TOKEN_BYTES).toString('hex')
      grants.set(token, { ...scope, expiresAt: now + FILE_PREVIEW_TOKEN_TTL_MS })
      return token
    },

    resolve(token, now = Date.now()): FilePreviewAccessScope | null {
      const grant = grants.get(token)
      if (grant === undefined) return null
      if (grant.expiresAt <= now) {
        grants.delete(token)
        return null
      }
      return { projectPath: grant.projectPath, path: grant.path }
    },
  })
}
