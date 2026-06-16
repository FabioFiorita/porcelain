import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'

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

export function commentsPath(): string {
  // Must match src/mcp/comment-file.ts. PORCELAIN_COMMENTS redirects both sides for
  // dev/tests.
  return process.env.PORCELAIN_COMMENTS ?? join(homedir(), '.porcelain', 'comments.json')
}

async function readAll(): Promise<ReviewComments> {
  try {
    return reviewCommentsSchema.parse(JSON.parse(await readFile(commentsPath(), 'utf8')))
  } catch {
    // absent, unparseable, or schema-invalid — treat as empty
    return {}
  }
}

async function writeAll(all: ReviewComments): Promise<void> {
  const path = commentsPath()
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(all, null, 2))
  await rename(tmp, path)
}

// Serialize app-side read-modify-write so two quick mutations never drop a write.
let chain: Promise<void> = Promise.resolve()
function mutate<T>(fn: (all: ReviewComments) => T): Promise<T> {
  const run = chain.then(async () => {
    const all = await readAll()
    const result = fn(all)
    await writeAll(all)
    return result
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** The review comments for a repo, newest first. */
export async function readComments(repoPath: string): Promise<ReviewComment[]> {
  const comments = (await readAll())[repoPath] ?? []
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
  await mutate((all) => {
    all[repoPath] = [...(all[repoPath] ?? []), comment]
  })
  return comment
}

export async function editComment(repoPath: string, id: string, body: string): Promise<void> {
  await mutate((all) => {
    const comment = all[repoPath]?.find((c) => c.id === id)
    if (comment) comment.body = body
  })
}

export async function deleteComment(repoPath: string, id: string): Promise<void> {
  await mutate((all) => {
    const comments = all[repoPath]
    if (comments) all[repoPath] = comments.filter((c) => c.id !== id)
  })
}

export async function setCommentResolved(
  repoPath: string,
  id: string,
  resolved: boolean,
): Promise<void> {
  await mutate((all) => {
    const comment = all[repoPath]?.find((c) => c.id === id)
    if (comment) comment.resolved = resolved
  })
}
