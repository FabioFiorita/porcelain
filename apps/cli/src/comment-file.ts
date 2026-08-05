import { ACTIVE_FILES } from '@shared/project-porcelain'
import { readProjectJson, writeProjectJson } from './project-io'

// Active review comments — <repo>/.porcelain/comments.json

export interface Comment {
  id: string
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
  resolved: boolean
  createdAt: number
  agentReply?: { body: string; createdAt: number }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseComments(value: unknown): Comment[] {
  if (!Array.isArray(value)) return []
  const comments: Comment[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || typeof item.path !== 'string') continue
    if (typeof item.body !== 'string') continue
    const comment: Comment = {
      id: item.id,
      path: item.path,
      body: item.body,
      resolved: item.resolved === true,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    }
    if (typeof item.startLine === 'number') comment.startLine = item.startLine
    if (typeof item.endLine === 'number') comment.endLine = item.endLine
    if (typeof item.anchorText === 'string') comment.anchorText = item.anchorText
    if (
      isRecord(item.agentReply) &&
      typeof item.agentReply.body === 'string' &&
      typeof item.agentReply.createdAt === 'number'
    ) {
      comment.agentReply = { body: item.agentReply.body, createdAt: item.agentReply.createdAt }
    }
    comments.push(comment)
  }
  return comments
}

function readAll(repoPath: string): Comment[] {
  return parseComments(readProjectJson(repoPath, ACTIVE_FILES.comments))
}

function writeAll(repoPath: string, comments: Comment[]): void {
  writeProjectJson(repoPath, ACTIVE_FILES.comments, comments)
}

export function readComments(repoPath: string): Comment[] {
  return readAll(repoPath)
}

export function resolveComment(repoPath: string, id: string): boolean {
  const comments = readAll(repoPath)
  const target = comments.find((c) => c.id === id)
  if (!target || target.resolved) return false
  target.resolved = true
  writeAll(repoPath, comments)
  return true
}

export function answerComment(repoPath: string, id: string, body: string): boolean {
  if (body.trim().length === 0) return false
  const comments = readAll(repoPath)
  const target = comments.find((c) => c.id === id)
  if (!target) return false
  target.agentReply = { body, createdAt: Date.now() }
  writeAll(repoPath, comments)
  return true
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
