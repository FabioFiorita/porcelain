import { basename, join, sep } from 'node:path'

/**
 * Daemon-root Tasks storage layout: `<homeDir>/tasks/tasks.json` plus one attachment
 * directory per Task. The table is daemon-wide (issue #23) — deliberately NOT under a
 * repo's `.porcelain/`, because a Task may outlive, precede, or span the checkouts it
 * references. `homeDir` is always the caller's resolved `porcelainHome()`; taking it as a
 * parameter (rather than reading the env here) keeps this module testable without env
 * mutation, matching `canvas-porcelain`.
 *
 * The CLI and the daemon both import this layout so a Task the CLI writes is a Task the
 * daemon's store reads back with no format drift.
 */

export const TASKS_INDEX_FILE = 'tasks.json'
export const TASKS_ATTACHMENTS_DIR = 'attachments'

export function tasksDir(homeDir: string): string {
  return join(homeDir, 'tasks')
}

/** The manifest listing every Task on this daemon. */
export function tasksIndexPath(homeDir: string): string {
  return join(tasksDir(homeDir), TASKS_INDEX_FILE)
}

/** Root of every copied attachment. Confinement is checked against this directory. */
export function tasksAttachmentsRoot(homeDir: string): string {
  return join(tasksDir(homeDir), TASKS_ATTACHMENTS_DIR)
}

/** Attachment directory for one Task: `<homeDir>/tasks/attachments/<taskId>/`. */
export function taskAttachmentsDir(homeDir: string, taskId: string): string {
  return join(tasksAttachmentsRoot(homeDir), taskId)
}

/** Absolute path of a stored attachment from its wire-relative `storedPath`. */
export function taskAttachmentPath(homeDir: string, storedPath: string): string {
  return join(tasksAttachmentsRoot(homeDir), storedPath)
}

/**
 * Attachment size bound. Tasks are a coordination table, not a file server.
 *
 * The rules below are shared BECAUSE there are two writers: the daemon (`tasks-attachments.ts`)
 * and the CLI (`tasks-file.ts`). They copy into the same directory and their results are read
 * back by the same store, so a divergence between them is a silent data bug rather than a
 * compile error — which is exactly the kind of duplication that has to be deleted, not
 * documented.
 */
export const TASK_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  css: 'text/css',
  csv: 'text/csv',
  gif: 'image/gif',
  html: 'text/html',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json',
  log: 'text/plain',
  md: 'text/markdown',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  webp: 'image/webp',
  zip: 'application/zip',
}

/** Content type for a stored attachment name; unknown extensions stay opaque bytes. */
export function taskAttachmentMime(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return 'application/octet-stream'
  return MIME_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * A stored file name the caller cannot steer, or `null` when the source name is unusable.
 *
 * `basename` already strips every directory component, but `.`/`..`/empty survive it, and a
 * NUL byte would truncate the path at the syscall — so those are refused outright rather
 * than coerced into something plausible.
 */
/** Human Task id: `T-18`. Sequential per daemon, never padded, never `T-0`. */
export const TASK_SHORT_ID_PATTERN = /^T-[1-9][0-9]*$/

export function isTaskShortId(value: string): boolean {
  return TASK_SHORT_ID_PATTERN.test(value)
}

/** Next unused `T-n` after the highest number already on the table. */
export function nextTaskShortId(existing: readonly { shortId: string }[]): string {
  let max = 0
  for (const row of existing) {
    if (!isTaskShortId(row.shortId)) continue
    const n = Number(row.shortId.slice(2))
    if (Number.isInteger(n) && n > max) max = n
  }
  return `T-${max + 1}`
}

export function safeTaskAttachmentName(sourcePath: string): string | null {
  const name = basename(sourcePath)
  if (name === '' || name === '.' || name === '..') return null
  if (name.includes('\0') || name.includes('/') || name.includes(sep)) return null
  return name.slice(0, 200)
}
