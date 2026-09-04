/**
 * Strict version-1 Review comments file model — shared by the daemon adapter and the
 * dependency-free CLI. No Zod, no Node APIs: pure parse, serialize, and comment transitions.
 */

export const COMMENTS_FILE_VERSION = 1 as const
export const COMMENTS_FILE_MAX_BYTES = 512 * 1024

export type CommentsFileAgentReply = {
  body: string
  createdAt: number
}

/** One shared anchor vocabulary for file, Canvas, and whole-changeset discussions. */
export type CommentsFileAnchor =
  | {
      kind: 'file'
      path: string
      startLine?: number
      endLine?: number
      anchorText?: string
    }
  | { kind: 'canvas'; canvasId: string; section?: string }
  | { kind: 'changeset' }

export type CommentsFileComment = {
  id: string
  /** Missing only on pre-authorship version-1 files; those comments were user-authored. */
  author?: 'user' | 'agent'
  /** Present on old file comments; new writes use `anchor`. */
  path?: string
  startLine?: number
  endLine?: number
  anchorText?: string
  /** Canonical anchor for new comments. Missing only on legacy file comments. */
  anchor?: CommentsFileAnchor
  body: string
  resolved: boolean
  createdAt: number
  agentReply?: CommentsFileAgentReply
}

export type CommentsFileV1 = {
  version: typeof COMMENTS_FILE_VERSION
  comments: CommentsFileComment[]
}

export type CommentsFileParseErrorCode =
  | 'incompatible-version'
  | 'malformed'
  | 'duplicate-id'
  | 'invalid-comment'

export class CommentsFileParseError extends Error {
  readonly code: CommentsFileParseErrorCode

  constructor(code: CommentsFileParseErrorCode, message: string) {
    super(message)
    this.name = 'CommentsFileParseError'
    this.code = code
  }
}

export type CommentsCommentNotFoundError = {
  code: 'review.comment-not-found'
  commentId: string
}

export type CommentsRequestInvalidError = {
  code: 'request.invalid'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

function parseAnchor(value: unknown, index: number): CommentsFileAnchor {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}].anchor is invalid`)
  }
  if (value.kind === 'changeset' && Object.keys(value).length === 1) return { kind: 'changeset' }
  if (value.kind === 'canvas') {
    if (
      (Object.keys(value).length !== 2 && Object.keys(value).length !== 3) ||
      typeof value.canvasId !== 'string' ||
      value.canvasId.length === 0 ||
      (value.section !== undefined &&
        (typeof value.section !== 'string' || value.section.length === 0))
    ) {
      throw new CommentsFileParseError('invalid-comment', `comments[${index}].anchor is invalid`)
    }
    return value.section === undefined
      ? { kind: 'canvas', canvasId: value.canvasId }
      : { kind: 'canvas', canvasId: value.canvasId, section: value.section }
  }
  if (value.kind === 'file') {
    if (
      Object.keys(value).some(
        (key) => !['kind', 'path', 'startLine', 'endLine', 'anchorText'].includes(key),
      ) ||
      typeof value.path !== 'string' ||
      value.path.length === 0 ||
      (value.startLine !== undefined && !isPositiveInt(value.startLine)) ||
      (value.endLine !== undefined && !isPositiveInt(value.endLine)) ||
      (value.anchorText !== undefined && typeof value.anchorText !== 'string') ||
      (value.startLine !== undefined &&
        value.endLine !== undefined &&
        value.endLine < value.startLine)
    ) {
      throw new CommentsFileParseError('invalid-comment', `comments[${index}].anchor is invalid`)
    }
    return {
      kind: 'file',
      path: value.path,
      ...(value.startLine === undefined ? {} : { startLine: value.startLine }),
      ...(value.endLine === undefined ? {} : { endLine: value.endLine }),
      ...(value.anchorText === undefined ? {} : { anchorText: value.anchorText }),
    }
  }
  throw new CommentsFileParseError('invalid-comment', `comments[${index}].anchor is invalid`)
}

export function emptyCommentsFileV1(): CommentsFileV1 {
  return { version: COMMENTS_FILE_VERSION, comments: [] }
}

function parseAgentReply(value: unknown, index: number): CommentsFileAgentReply {
  if (!isRecord(value)) {
    throw new CommentsFileParseError(
      'invalid-comment',
      `comments[${index}].agentReply is not an object`,
    )
  }
  for (const key of Object.keys(value)) {
    if (key !== 'body' && key !== 'createdAt') {
      throw new CommentsFileParseError(
        'invalid-comment',
        `comments[${index}].agentReply has unknown field ${key}`,
      )
    }
  }
  if (typeof value.body !== 'string') {
    throw new CommentsFileParseError(
      'invalid-comment',
      `comments[${index}].agentReply.body is not a string`,
    )
  }
  if (!isSafeNonNegativeInt(value.createdAt)) {
    throw new CommentsFileParseError(
      'invalid-comment',
      `comments[${index}].agentReply.createdAt is invalid`,
    )
  }
  return { body: value.body, createdAt: value.createdAt }
}

function parseComment(value: unknown, index: number): CommentsFileComment {
  if (!isRecord(value)) {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}] is not an object`)
  }
  for (const key of Object.keys(value)) {
    if (
      key !== 'id' &&
      key !== 'author' &&
      key !== 'path' &&
      key !== 'startLine' &&
      key !== 'endLine' &&
      key !== 'anchorText' &&
      key !== 'anchor' &&
      key !== 'body' &&
      key !== 'resolved' &&
      key !== 'createdAt' &&
      key !== 'agentReply'
    ) {
      throw new CommentsFileParseError(
        'invalid-comment',
        `comments[${index}] has unknown field ${key}`,
      )
    }
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}].id is invalid`)
  }
  if (value.author !== undefined && value.author !== 'user' && value.author !== 'agent') {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}].author is invalid`)
  }
  if (value.path !== undefined && (typeof value.path !== 'string' || value.path.length === 0)) {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}].path is invalid`)
  }
  if (value.anchor === undefined && value.path === undefined) {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}] needs an anchor`)
  }
  if (typeof value.body !== 'string') {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}].body is not a string`)
  }
  if (typeof value.resolved !== 'boolean') {
    throw new CommentsFileParseError(
      'invalid-comment',
      `comments[${index}].resolved is not a boolean`,
    )
  }
  if (!isSafeNonNegativeInt(value.createdAt)) {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}].createdAt is invalid`)
  }
  if (value.startLine !== undefined && !isPositiveInt(value.startLine)) {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}].startLine is invalid`)
  }
  if (value.endLine !== undefined && !isPositiveInt(value.endLine)) {
    throw new CommentsFileParseError('invalid-comment', `comments[${index}].endLine is invalid`)
  }
  if (value.anchorText !== undefined && typeof value.anchorText !== 'string') {
    throw new CommentsFileParseError(
      'invalid-comment',
      `comments[${index}].anchorText is not a string`,
    )
  }

  const comment: CommentsFileComment = {
    id: value.id,
    body: value.body,
    resolved: value.resolved,
    createdAt: value.createdAt,
  }
  if (value.path !== undefined) comment.path = value.path
  if (value.author !== undefined) comment.author = value.author
  if (value.startLine !== undefined) comment.startLine = value.startLine
  if (value.endLine !== undefined) comment.endLine = value.endLine
  if (value.anchorText !== undefined) comment.anchorText = value.anchorText
  if (value.anchor !== undefined) comment.anchor = parseAnchor(value.anchor, index)
  if (value.agentReply !== undefined) {
    comment.agentReply = parseAgentReply(value.agentReply, index)
  }
  return comment
}

/** Parse an untrusted comments document. Throws {@link CommentsFileParseError} on any violation. */
export function parseCommentsFileV1(value: unknown): CommentsFileV1 {
  if (Array.isArray(value)) {
    throw new CommentsFileParseError(
      'malformed',
      'Comments file must be a version-1 object; top-level arrays are not supported',
    )
  }
  if (!isRecord(value)) {
    throw new CommentsFileParseError('malformed', 'Comments file must be a JSON object')
  }
  for (const key of Object.keys(value)) {
    if (key !== 'version' && key !== 'comments') {
      throw new CommentsFileParseError('malformed', `unknown field ${key}`)
    }
  }
  if (
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !Number.isFinite(value.version)
  ) {
    throw new CommentsFileParseError('malformed', 'version is required')
  }
  if (value.version !== COMMENTS_FILE_VERSION) {
    throw new CommentsFileParseError(
      'incompatible-version',
      `unsupported Comments file version ${String(value.version)}`,
    )
  }
  if (!Array.isArray(value.comments)) {
    throw new CommentsFileParseError('malformed', 'comments must be an array')
  }

  const comments: CommentsFileComment[] = []
  const seen = new Set<string>()
  for (let index = 0; index < value.comments.length; index += 1) {
    const comment = parseComment(value.comments[index], index)
    if (seen.has(comment.id)) {
      throw new CommentsFileParseError('duplicate-id', `duplicate comment id ${comment.id}`)
    }
    seen.add(comment.id)
    comments.push(comment)
  }
  return { version: COMMENTS_FILE_VERSION, comments }
}

export function serializeCommentsFileV1(value: CommentsFileV1): string {
  const valid = parseCommentsFileV1(value)
  return `${JSON.stringify(valid, null, 2)}\n`
}

/** List order: createdAt descending, then id ascending for ties. */
export function sortComments(comments: readonly CommentsFileComment[]): CommentsFileComment[] {
  return [...comments].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
    if (a.id < b.id) return -1
    if (a.id > b.id) return 1
    return 0
  })
}

function cloneComment(comment: CommentsFileComment): CommentsFileComment {
  const next: CommentsFileComment = {
    id: comment.id,
    body: comment.body,
    resolved: comment.resolved,
    createdAt: comment.createdAt,
  }
  if (comment.path !== undefined) next.path = comment.path
  if (comment.author !== undefined) next.author = comment.author
  if (comment.startLine !== undefined) next.startLine = comment.startLine
  if (comment.endLine !== undefined) next.endLine = comment.endLine
  if (comment.anchorText !== undefined) next.anchorText = comment.anchorText
  if (comment.anchor !== undefined) next.anchor = { ...comment.anchor }
  if (comment.agentReply !== undefined) {
    next.agentReply = { body: comment.agentReply.body, createdAt: comment.agentReply.createdAt }
  }
  return next
}

function withComments(_file: CommentsFileV1, comments: CommentsFileComment[]): CommentsFileV1 {
  return { version: COMMENTS_FILE_VERSION, comments }
}

export function planAddReviewComment(
  file: CommentsFileV1,
  input: {
    id: string
    path?: string
    anchor?: CommentsFileAnchor
    startLine?: number
    endLine?: number
    anchorText?: string
    body: string
    author?: 'user' | 'agent'
    createdAt: number
  },
):
  | { ok: true; file: CommentsFileV1; comment: CommentsFileComment }
  | { ok: false; error: CommentsRequestInvalidError } {
  if (input.anchor === undefined && (input.path === undefined || input.path.length === 0)) {
    return { ok: false, error: { code: 'request.invalid' } }
  }
  if (
    input.startLine !== undefined &&
    input.endLine !== undefined &&
    input.endLine < input.startLine
  ) {
    return { ok: false, error: { code: 'request.invalid' } }
  }

  const comment: CommentsFileComment = {
    id: input.id,
    author: input.author ?? 'user',
    body: input.body,
    resolved: false,
    createdAt: input.createdAt,
  }
  if (input.path !== undefined) comment.path = input.path
  if (input.anchor !== undefined) comment.anchor = { ...input.anchor }
  if (input.startLine !== undefined) comment.startLine = input.startLine
  if (input.endLine !== undefined) comment.endLine = input.endLine
  if (input.anchorText !== undefined) comment.anchorText = input.anchorText

  return {
    ok: true,
    file: withComments(file, [...file.comments.map(cloneComment), comment]),
    comment,
  }
}

export function planEditReviewComment(
  file: CommentsFileV1,
  input: { commentId: string; body: string },
):
  | { ok: true; file: CommentsFileV1; comment: CommentsFileComment }
  | { ok: false; error: CommentsCommentNotFoundError } {
  const index = file.comments.findIndex((comment) => comment.id === input.commentId)
  if (index < 0) {
    return { ok: false, error: { code: 'review.comment-not-found', commentId: input.commentId } }
  }
  const current = file.comments[index]
  if (current === undefined) {
    return { ok: false, error: { code: 'review.comment-not-found', commentId: input.commentId } }
  }

  const comment = cloneComment(current)
  comment.body = input.body
  const comments = file.comments.map(cloneComment)
  comments[index] = comment
  return { ok: true, file: withComments(file, comments), comment }
}

export function planDeleteReviewComment(
  file: CommentsFileV1,
  input: { commentId: string },
):
  | { ok: true; file: CommentsFileV1; commentId: string }
  | { ok: false; error: CommentsCommentNotFoundError } {
  if (!file.comments.some((comment) => comment.id === input.commentId)) {
    return { ok: false, error: { code: 'review.comment-not-found', commentId: input.commentId } }
  }
  return {
    ok: true,
    file: withComments(
      file,
      file.comments.filter((comment) => comment.id !== input.commentId).map(cloneComment),
    ),
    commentId: input.commentId,
  }
}

export function planSetReviewCommentResolved(
  file: CommentsFileV1,
  input: { commentId: string; resolved: boolean },
):
  | { ok: true; file: CommentsFileV1; comment: CommentsFileComment }
  | { ok: false; error: CommentsCommentNotFoundError } {
  const index = file.comments.findIndex((comment) => comment.id === input.commentId)
  if (index < 0) {
    return { ok: false, error: { code: 'review.comment-not-found', commentId: input.commentId } }
  }
  const current = file.comments[index]
  if (current === undefined) {
    return { ok: false, error: { code: 'review.comment-not-found', commentId: input.commentId } }
  }

  const comment = cloneComment(current)
  comment.resolved = input.resolved
  const comments = file.comments.map(cloneComment)
  comments[index] = comment
  return { ok: true, file: withComments(file, comments), comment }
}

export function planClearResolvedReviewComments(file: CommentsFileV1): {
  ok: true
  file: CommentsFileV1
  removedIds: string[]
} {
  const removed = file.comments.filter((comment) => comment.resolved)
  return {
    ok: true,
    file: withComments(
      file,
      file.comments.filter((comment) => !comment.resolved).map(cloneComment),
    ),
    removedIds: removed.map((comment) => comment.id),
  }
}

/** CLI-only planner: attach or replace an agent reply without daemon wire surface. */
export function planAnswerReviewComment(
  file: CommentsFileV1,
  input: { commentId: string; body: string; createdAt: number },
):
  | { ok: true; file: CommentsFileV1; comment: CommentsFileComment }
  | { ok: false; error: CommentsCommentNotFoundError } {
  const index = file.comments.findIndex((comment) => comment.id === input.commentId)
  if (index < 0) {
    return { ok: false, error: { code: 'review.comment-not-found', commentId: input.commentId } }
  }
  const current = file.comments[index]
  if (current === undefined) {
    return { ok: false, error: { code: 'review.comment-not-found', commentId: input.commentId } }
  }

  const comment = cloneComment(current)
  comment.agentReply = { body: input.body, createdAt: input.createdAt }
  const comments = file.comments.map(cloneComment)
  comments[index] = comment
  return { ok: true, file: withComments(file, comments), comment }
}
