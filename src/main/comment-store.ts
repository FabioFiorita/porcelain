import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createHomeChannel } from './home-channel'

/**
 * The review-comment channel: the human's notes on lines/files, keyed by absolute
 * repo path, in `~/.porcelain/comments.json` (NOT the work repo, NOT userData — a
 * plain `node` MCP process can't resolve userData, so both sides agree on this fixed
 * home-dir path, like the review-set channel). This is a TWO-WAY channel: the app
 * authors comments (add/edit/delete/resolve here) and the MCP server (src/mcp/
 * comment-file.ts) reads them and may flip `resolved`. Distinct from review-sets, so
 * the "app makes one write to the review-set channel" invariant is untouched. App
 * writes are atomic (tmp + rename) and serialized in-process; a cross-process race
 * with an MCP resolve is rare, low-stakes (a lost resolve just reappears), and the
 * watcher re-syncs.
 */
export const reviewCommentSchema = z.object({
  id: z.string(),
  /** Repo-relative path of the file the comment is anchored to. */
  path: z.string().min(1),
  /** 1-based new-side line range; omitted for a file-level comment. */
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  /** Snippet of the anchored lines, for agent context + best-effort re-anchoring. */
  anchorText: z.string().optional(),
  body: z.string(),
  resolved: z.boolean().default(false),
  createdAt: z.number(),
})
export type ReviewComment = z.infer<typeof reviewCommentSchema>

export const reviewCommentsSchema = z.record(z.string(), z.array(reviewCommentSchema))
export type ReviewComments = z.infer<typeof reviewCommentsSchema>

const channel = createHomeChannel({
  envVar: 'PORCELAIN_COMMENTS',
  fileName: 'comments.json',
  schema: reviewCommentsSchema,
  empty: (): ReviewComments => ({}),
})

// Must match src/mcp/comment-file.ts. PORCELAIN_COMMENTS redirects both sides for
// dev/tests.
export const commentsPath = channel.path

/** The review comments for a repo, newest first. */
export async function readComments(repoPath: string): Promise<ReviewComment[]> {
  const comments = (await channel.readAll())[repoPath] ?? []
  return [...comments].sort((a, b) => b.createdAt - a.createdAt)
}

export interface NewComment {
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
}

export async function addComment(repoPath: string, input: NewComment): Promise<ReviewComment> {
  const comment: ReviewComment = {
    id: randomUUID(),
    path: input.path,
    body: input.body,
    resolved: false,
    createdAt: Date.now(),
    ...(input.startLine !== undefined ? { startLine: input.startLine } : {}),
    ...(input.endLine !== undefined ? { endLine: input.endLine } : {}),
    ...(input.anchorText !== undefined ? { anchorText: input.anchorText } : {}),
  }
  await channel.mutate((all) => {
    all[repoPath] = [...(all[repoPath] ?? []), comment]
  })
  return comment
}

export async function editComment(repoPath: string, id: string, body: string): Promise<void> {
  await channel.mutate((all) => {
    const comment = all[repoPath]?.find((c) => c.id === id)
    if (comment) comment.body = body
  })
}

export async function deleteComment(repoPath: string, id: string): Promise<void> {
  await channel.mutate((all) => {
    const comments = all[repoPath]
    if (comments) all[repoPath] = comments.filter((c) => c.id !== id)
  })
}

export async function setCommentResolved(
  repoPath: string,
  id: string,
  resolved: boolean,
): Promise<void> {
  await channel.mutate((all) => {
    const comment = all[repoPath]?.find((c) => c.id === id)
    if (comment) comment.resolved = resolved
  })
}
