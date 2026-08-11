import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  COMMENTS_FILE_MAX_BYTES,
  type CommentsFileComment,
  CommentsFileParseError,
  emptyCommentsFileV1,
  parseCommentsFileV1,
  planAnswerReviewComment,
  planSetReviewCommentResolved,
  serializeCommentsFileV1,
  sortComments,
} from '@porcelain/shared/comments-file'
import { ACTIVE_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { ensureProjectDir } from './project-io'

// Builtins + @porcelain/shared only — see cli.ts. Active review comments are strict v1 JSON.

export type Comment = CommentsFileComment

function commentsPath(repoPath: string): string {
  return projectPorcelainPath(repoPath, ACTIVE_FILES.comments)
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  )
}

function readCommentsFile(repoPath: string): ReturnType<typeof emptyCommentsFileV1> {
  let raw: string
  try {
    raw = readFileSync(commentsPath(repoPath), 'utf8')
  } catch (error) {
    if (isEnoent(error)) return emptyCommentsFileV1()
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new CommentsFileParseError('malformed', 'Comments file is not valid JSON')
  }

  // Legacy top-level array is not accepted — agents must use the v1 document.
  if (Array.isArray(parsed)) {
    throw new CommentsFileParseError(
      'malformed',
      'Comments file must be version 1 ({ version: 1, comments: [...] }); top-level arrays are not supported',
    )
  }

  return parseCommentsFileV1(parsed)
}

function writeCommentsFile(
  repoPath: string,
  file: ReturnType<typeof emptyCommentsFileV1>,
): boolean {
  const body = serializeCommentsFileV1(file)
  if (Buffer.byteLength(body, 'utf8') > COMMENTS_FILE_MAX_BYTES) return false
  ensureProjectDir(repoPath)
  const path = commentsPath(repoPath)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, body)
  renameSync(tmp, path)
  return true
}

export function readComments(repoPath: string): Comment[] {
  return sortComments(readCommentsFile(repoPath).comments)
}

export function resolveComment(repoPath: string, id: string): boolean {
  const file = readCommentsFile(repoPath)
  const target = file.comments.find((c) => c.id === id)
  if (!target || target.resolved) return false
  const planned = planSetReviewCommentResolved(file, { commentId: id, resolved: true })
  if (!planned.ok) return false
  return writeCommentsFile(repoPath, planned.file)
}

export function answerComment(repoPath: string, id: string, body: string): boolean {
  if (body.trim().length === 0) return false
  const planned = planAnswerReviewComment(readCommentsFile(repoPath), {
    commentId: id,
    body,
    createdAt: Date.now(),
  })
  if (!planned.ok) return false
  return writeCommentsFile(repoPath, planned.file)
}

function describeOne(c: Comment, sourceOf?: ReadonlyMap<string, string>): string {
  const where =
    c.startLine === undefined
      ? c.path
      : c.endLine && c.endLine !== c.startLine
        ? `${c.path}:${c.startLine}-${c.endLine}`
        : `${c.path}:${c.startLine}`
  const status = sourceOf?.get(c.path)
  const tag = status ? ` (${status})` : ''
  const anchor = c.anchorText ? `\n    « ${c.anchorText.replace(/\n/g, '\n      ')} »` : ''
  const reply = c.agentReply ? `\n    ↳ answered: ${c.agentReply.body.split('\n')[0]}` : ''
  return `- [${c.id}] ${where}${tag}${anchor}\n    ${c.body}${reply}`
}

export function describeComments(
  repoPath: string,
  comments: Comment[],
  sourceOf?: ReadonlyMap<string, string>,
): string {
  const open = comments.filter((c) => !c.resolved)
  const resolved = comments.length - open.length
  if (comments.length === 0) {
    return `No review comments for ${repoPath}. The reviewer adds them in Porcelain; they show up here as context (.porcelain/comments.json).`
  }
  if (open.length === 0) {
    return `No open review comments for ${repoPath} (${resolved} resolved).`
  }
  const body = open.map((c) => describeOne(c, sourceOf)).join('\n')
  return `${open.length} open review comment(s) for ${repoPath}${resolved ? ` (${resolved} resolved)` : ''}. Answer with \`porcelain comments answer\`, resolve with \`porcelain comments resolve\`:\n${body}`
}
