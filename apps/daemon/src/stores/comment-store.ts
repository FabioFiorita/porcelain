import { randomUUID } from 'node:crypto'
import { ACTIVE_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
import { ensureProjectCompanion } from '../project/migrate-home'

/**
 * Review comments for the **active** review — `<repo>/.porcelain/comments.json`.
 * TWO-WAY: app authors; CLI reads and may resolve / answer.
 * Archived with the review on clear (see review-store archive).
 */
export const reviewCommentSchema = z.object({
  id: z.string(),
  path: z.string().min(1),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  anchorText: z.string().optional(),
  body: z.string(),
  resolved: z.boolean().default(false),
  createdAt: z.number(),
  agentReply: z.object({ body: z.string(), createdAt: z.number() }).optional(),
})
export type ReviewComment = z.infer<typeof reviewCommentSchema>

const commentsSchema = z.array(reviewCommentSchema)

const channel = createProjectChannel({
  fileName: ACTIVE_FILES.comments,
  schema: commentsSchema,
  empty: (): ReviewComment[] => [],
})

export function commentsPath(repoPath: string): string {
  return channel.path(repoPath)
}

async function ready(repoPath: string): Promise<void> {
  await ensureProjectCompanion(repoPath)
}

export async function readComments(repoPath: string): Promise<ReviewComment[]> {
  await ready(repoPath)
  const comments = await channel.read(repoPath)
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
  await ready(repoPath)
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
  await channel.mutate(repoPath, (all) => [...all, comment])
  return comment
}

export async function editComment(repoPath: string, id: string, body: string): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => {
    const comment = all.find((c) => c.id === id)
    if (comment) comment.body = body
    return all
  })
}

export async function deleteComment(repoPath: string, id: string): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => all.filter((c) => c.id !== id))
}

export async function clearResolvedComments(repoPath: string): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => all.filter((c) => !c.resolved))
}

export async function setCommentResolved(
  repoPath: string,
  id: string,
  resolved: boolean,
): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => {
    const comment = all.find((c) => c.id === id)
    if (comment) comment.resolved = resolved
    return all
  })
}

export async function writeComments(repoPath: string, comments: ReviewComment[]): Promise<void> {
  await ready(repoPath)
  await channel.write(repoPath, comments)
}
