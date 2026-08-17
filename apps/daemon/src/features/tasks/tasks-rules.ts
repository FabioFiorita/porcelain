import type { Task, TaskLink, TaskStatus, TasksResult } from './tasks-capabilities'

/** Title bound shared with the wire contract and the public invalid-title error. */
export const TASK_TITLE_MAX_LENGTH = 240

/**
 * Pure Task rules. The wire schema already trims and bounds, but the store is also written
 * by the CLI, so the operation re-checks rather than trusting whatever reached it.
 */

export function validateTitle(title: string): TasksResult<string> {
  const trimmed = title.trim()
  if (trimmed === '') {
    return { ok: false, error: { code: 'tasks.invalid-title', reason: 'blank', maxLength: 240 } }
  }
  if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
    return { ok: false, error: { code: 'tasks.invalid-title', reason: 'too-long', maxLength: 240 } }
  }
  return { ok: true, value: trimmed }
}

/** Trim, drop blanks, and de-duplicate tags while keeping the caller's order. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (trimmed === '' || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export function normalizeLinks(links: readonly TaskLink[]): TaskLink[] {
  return links.map((link) => ({ url: link.url, label: link.label.trim() }))
}

/**
 * Newest first, then id — a table needs a total order, and `updatedAt` alone ties whenever
 * two rows are written inside the same millisecond.
 */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) return left.updatedAt < right.updatedAt ? 1 : -1
    return left.id < right.id ? -1 : 1
  })
}

export function defaultStatus(status: TaskStatus | undefined): TaskStatus {
  return status ?? 'todo'
}

/** Decode one browser/CLI upload. Invalid base64 is a typed rejection, not a throw. */
export function decodeAttachmentUpload(contentBase64: string): TasksResult<Uint8Array> {
  try {
    const bytes = Buffer.from(contentBase64, 'base64')
    if (bytes.byteLength === 0) {
      return { ok: false, error: { code: 'tasks.attachment-rejected', reason: 'invalid-bytes' } }
    }
    // Buffer.from silently skips bad characters; reject if the round-trip does not match.
    if (bytes.toString('base64').replace(/=+$/, '') !== contentBase64.replace(/=+$/, '')) {
      return { ok: false, error: { code: 'tasks.attachment-rejected', reason: 'invalid-bytes' } }
    }
    return { ok: true, value: bytes }
  } catch {
    return { ok: false, error: { code: 'tasks.attachment-rejected', reason: 'invalid-bytes' } }
  }
}
