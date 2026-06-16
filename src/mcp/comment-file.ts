import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see protocol.ts for why this server must stay dependency-free.
// This is the SECOND agent channel, parallel to review-file.ts but flowing the other
// way: the Porcelain APP authors review comments (the human's notes on lines/files),
// the AGENT reads them as context here and may mark one resolved. Both sides honour
// PORCELAIN_COMMENTS so tests/dev can redirect it; default lives in ~/.porcelain.
// Writes are atomic (tmp + rename); the app re-validates with zod on read.

export interface Comment {
  id: string
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
  resolved: boolean
  createdAt: number
}

type Comments = Record<string, Comment[]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function commentsPath(): string {
  return process.env.PORCELAIN_COMMENTS ?? join(homedir(), '.porcelain', 'comments.json')
}

/** Lenient parse of our own file: skip malformed rows, never throw. */
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
    comments.push(comment)
  }
  return comments
}

function readAll(): Comments {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(commentsPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Comments = {}
  for (const [repoPath, value] of Object.entries(parsed)) {
    all[repoPath] = parseComments(value)
  }
  return all
}

function writeAll(all: Comments): void {
  const path = commentsPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(all, null, 2))
  renameSync(tmp, path)
}

/** The human's review comments for a repo (empty when none / file absent). */
export function readComments(repoPath: string): Comment[] {
  return readAll()[repoPath] ?? []
}

/** Mark a comment resolved. Returns true if it was found (and not already resolved). */
export function resolveComment(repoPath: string, id: string): boolean {
  const all = readAll()
  const comments = all[repoPath]
  if (!comments) return false
  const target = comments.find((c) => c.id === id)
  if (!target || target.resolved) return false
  target.resolved = true
  writeAll(all)
  return true
}

function describeOne(c: Comment): string {
  const where =
    c.startLine === undefined
      ? c.path
      : c.endLine && c.endLine !== c.startLine
        ? `${c.path}:${c.startLine}-${c.endLine}`
        : `${c.path}:${c.startLine}`
  const anchor = c.anchorText ? `\n    « ${c.anchorText.replace(/\n/g, '\n      ')} »` : ''
  return `- [${c.id}] ${where}${anchor}\n    ${c.body}`
}

/**
 * Render a repo's comments for the read tool: the OPEN comments (what the reviewer
 * still wants addressed) listed with their file/line anchor, the anchored snippet,
 * and the note — followed by a resolved count. Each carries its id so the agent can
 * resolve_review_comment once it has addressed the note.
 */
export function describeComments(repoPath: string, comments: Comment[]): string {
  const open = comments.filter((c) => !c.resolved)
  const resolved = comments.length - open.length
  if (comments.length === 0) {
    return `No review comments for ${repoPath}. The reviewer adds them in Porcelain by selecting lines (or a file) and writing a note; they show up here as context.`
  }
  if (open.length === 0) {
    return `No open review comments for ${repoPath} (${resolved} resolved).`
  }
  const body = open.map(describeOne).join('\n')
  return `${open.length} open review comment(s) for ${repoPath}${resolved ? ` (${resolved} resolved)` : ''}. Resolve each with resolve_review_comment once addressed:\n${body}`
}
