import { randomUUID } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { isInsideDir } from '@shared/canvas-porcelain'
import { porcelainHome } from '@shared/porcelain-home'
import {
  isTaskShortId,
  nextTaskShortId,
  safeTaskAttachmentName,
  TASK_ATTACHMENT_MAX_BYTES,
  taskAttachmentMime,
  taskAttachmentsDir,
  tasksAttachmentsRoot,
  tasksIndexPath,
} from '@shared/tasks-porcelain'
import { resolveHubIdentity } from './canvas-file'

/**
 * Writes the daemon-wide Tasks table the same way the daemon's tasks-store reads it
 * (apps/daemon/src/features/tasks/tasks-store.ts): a single strict JSON document
 * `{ version: 1, value: { tasks: [...] } }` under `$PORCELAIN_HOME/tasks/`, plus one
 * attachment directory per Task. Like Canvas — and unlike every repo-local noun — this
 * root is NOT `<repo>/.porcelain/`: a Task may outlive, precede, or span the checkouts it
 * references (issue #23), so it belongs to the Environment daemon, not to this checkout.
 *
 * Every row here must satisfy `taskSchema` in packages/contracts (a row the daemon cannot
 * parse makes the WHOLE table read as corrupt), but the CLI is locked to node: builtins +
 * @porcelain/shared (scripts/lint-cli-boundary.mjs), so the shape is mirrored structurally
 * and `tasks-file.test.ts` parses a written row against the real schema to pin the two
 * together.
 *
 * Attachment rules (absolute source, regular file, caller-proof stored name, confinement
 * re-checked after symlinks resolve) mirror the daemon's tasks-attachments.ts for the same
 * reason: two writers of one store must not disagree about what is storable.
 */

/** cli.ts's help-registry entry, kept here to hold that shrink-only file's line budget. */
export const TASKS_COMMANDS = {
  noun: 'tasks',
  blurb: 'the daemon-wide Tasks table — work that spans (or outlives) any one checkout',
  verbs: [
    { verb: 'list', args: '', desc: 'List every Task on this daemon' },
    {
      verb: 'add',
      args: '--title <s> [--notes <s>] [--status todo|doing|done|blocked] [--tags a,b] [--link <url>] [--link-label <s>] [--attach <abs path>] [--file <path>] [--folder <path>] [--project-id <s>] [--worktree-id <s>]',
      desc: 'Create a Task (references default to the current checkout)',
    },
    {
      verb: 'get',
      args: '--id <s>',
      desc: 'Print one Task (UUID or T-18) so an agent can pick it up',
    },
    {
      verb: 'update',
      args: '--id <s> [--title <s>] [--notes <s>] [--status <s>] [--tags a,b]',
      desc: "Edit a Task's fields",
    },
    { verb: 'done', args: '--id <s>', desc: 'Mark a Task done (shorthand for --status done)' },
  ],
  flags: [
    'title',
    'notes',
    'status',
    'tags',
    'link',
    'link-label',
    'attach',
    'file',
    'folder',
    'project-id',
    'worktree-id',
    'id',
  ],
  flagOverrides: {
    status: 'Task status: todo | doing | done | blocked',
    notes: 'Markdown notes for the Task',
    tags: 'Comma-separated tags, e.g. infra,flaky',
    link: 'An http(s) URL to attach to the Task',
    'link-label': 'Label for --link (default: the URL itself)',
    attach: "Absolute path to a file copied into the daemon's Task attachment store",
    file: 'Worktree-relative file to tag (not copied); requires a Project',
    folder: 'Worktree-relative folder to tag (not copied); requires a Project',
    'project-id':
      'Project the Task points at (default: the Project this checkout belongs to, when Porcelain knows it)',
    'worktree-id': 'Worktree the Task points at; requires --project-id',
    id: 'Task UUID or short id (T-18)',
  },
}

const TASK_STATUSES = ['todo', 'doing', 'done', 'blocked'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

type TaskReferences = { projectId?: string; worktreeId?: string }
type TaskLink = { url: string; label: string }
type TaskPathRef = {
  projectId: string
  worktreeId: string
  path: string
  kind: 'file' | 'folder'
}
export type TaskAttachment = {
  id: string
  name: string
  storedPath: string
  byteSize: number
  mime: string
}

export type Task = {
  id: string
  shortId: string
  title: string
  notes?: string
  status: TaskStatus
  tags: string[]
  references: TaskReferences
  pathRefs: TaskPathRef[]
  attachments: TaskAttachment[]
  links: TaskLink[]
  createdAt: string
  updatedAt: string
}

export function normalizeTaskStatus(value: unknown): TaskStatus | null {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
    ? (value as TaskStatus)
    : null
}

/** Trimmed, blank-dropped, de-duplicated, order preserved. */
export function normalizeTags(raw: string | undefined): string[] {
  if (raw === undefined) return []
  const seen = new Set<string>()
  for (const entry of raw.split(',')) {
    const tag = entry.trim()
    if (tag !== '') seen.add(tag)
  }
  return [...seen]
}

type TasksEnvelope = { version: 1; value: { tasks: Task[] } }

/** Every Task on this daemon, in write order. A missing table reads as empty. */
export function readTasks(): Task[] {
  try {
    const parsed = JSON.parse(
      readFileSync(tasksIndexPath(porcelainHome()), 'utf8'),
    ) as TasksEnvelope
    return Array.isArray(parsed.value?.tasks) ? parsed.value.tasks : []
  } catch {
    return []
  }
}

function writeTasks(tasks: Task[]): void {
  const path = tasksIndexPath(porcelainHome())
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${randomUUID()}`
  const envelope: TasksEnvelope = { version: 1, value: { tasks } }
  writeFileSync(tmp, `${JSON.stringify(envelope, null, 2)}\n`)
  renameSync(tmp, path)
}

/** Copy one source file into `<home>/tasks/attachments/<taskId>/<uuid>-<basename>`. */
export function attachFile(taskId: string, sourcePath: string): TaskAttachment {
  if (!isAbsolute(sourcePath)) throw new Error('--attach must be an absolute path')
  const storedName = safeTaskAttachmentName(sourcePath)
  if (storedName === null) throw new Error(`--attach has an unsafe file name: ${sourcePath}`)

  let sourceReal: string
  try {
    sourceReal = realpathSync(sourcePath)
  } catch {
    throw new Error(`--attach not found: ${sourcePath}`)
  }
  const info = statSync(sourceReal)
  if (!info.isFile()) throw new Error(`--attach must be a regular file: ${sourcePath}`)
  if (info.size > TASK_ATTACHMENT_MAX_BYTES) {
    throw new Error(`--attach is larger than ${TASK_ATTACHMENT_MAX_BYTES} bytes: ${sourcePath}`)
  }

  const homeDir = porcelainHome()
  const root = resolve(tasksAttachmentsRoot(homeDir))
  const attachmentId = randomUUID()
  const taskDirLexical = resolve(taskAttachmentsDir(homeDir, taskId))
  if (!isInsideDir(root, taskDirLexical))
    throw new Error(`--attach has an unsafe task id: ${taskId}`)

  mkdirSync(taskDirLexical, { recursive: true })
  // The directory may already exist as (or through) a symlink; resolving it and re-checking
  // is what stops a pre-planted link from redirecting the copy outside the store.
  mkdirSync(root, { recursive: true })
  const rootReal = realpathSync(root)
  const taskDirReal = realpathSync(taskDirLexical)
  if (!isInsideDir(rootReal, taskDirReal)) {
    throw new Error(`--attach resolved outside the attachment store: ${sourcePath}`)
  }
  const destination = resolve(taskDirReal, `${attachmentId}-${storedName}`)
  copyFileSync(sourceReal, destination)

  return {
    id: attachmentId,
    name: storedName,
    storedPath: relative(rootReal, destination).split(sep).join('/'),
    byteSize: info.size,
    mime: taskAttachmentMime(storedName),
  }
}

/**
 * The references a new Task defaults to: the Project (and Worktree) the Hub already minted
 * for this checkout. A repo Porcelain has never opened has no Project id — a Task is still
 * a perfectly good Task without one, so that degrades to no references rather than failing.
 */
function defaultReferences(repoPath: string): TaskReferences {
  try {
    const identity = resolveHubIdentity(repoPath)
    return identity.worktreeId === null
      ? { projectId: identity.projectId }
      : { projectId: identity.projectId, worktreeId: identity.worktreeId }
  } catch {
    return {}
  }
}

export function createTask(options: {
  repoPath: string
  title: string
  notes?: string
  status?: TaskStatus
  tags?: string[]
  projectId?: string
  worktreeId?: string
  link?: { url: string; label?: string }
  attachPath?: string
  filePath?: string
  folderPath?: string
}): Task {
  const title = options.title.trim()
  if (title === '') throw new Error('title is required')

  let references: TaskReferences
  if (options.projectId !== undefined) {
    references =
      options.worktreeId === undefined
        ? { projectId: options.projectId }
        : { projectId: options.projectId, worktreeId: options.worktreeId }
  } else {
    if (options.worktreeId !== undefined) {
      throw new Error('--worktree-id requires --project-id')
    }
    references = defaultReferences(options.repoPath)
  }

  const existing = readTasks()
  const id = randomUUID()
  const now = new Date().toISOString()
  const pathRefs = buildPathRefs(references, options.filePath, options.folderPath)
  const links: TaskLink[] =
    options.link === undefined
      ? []
      : [
          {
            url: options.link.url,
            label: (options.link.label ?? options.link.url).trim().slice(0, 160),
          },
        ]
  const attachments =
    options.attachPath === undefined ? [] : [attachFile(id, options.attachPath.trim())]

  const task: Task = {
    id,
    shortId: nextTaskShortId(existing),
    title,
    status: options.status ?? 'todo',
    tags: options.tags ?? [],
    references,
    pathRefs,
    attachments,
    links,
    createdAt: now,
    updatedAt: now,
  }
  if (options.notes !== undefined && options.notes !== '') task.notes = options.notes

  writeTasks([...existing, task])
  return task
}

function buildPathRefs(
  references: TaskReferences,
  filePath?: string,
  folderPath?: string,
): TaskPathRef[] {
  const refs: TaskPathRef[] = []
  if (filePath !== undefined && filePath !== '') {
    if (references.projectId === undefined || references.worktreeId === undefined) {
      throw new Error(
        '--file requires a Project and Worktree (pass --project-id and --worktree-id)',
      )
    }
    refs.push({
      projectId: references.projectId,
      worktreeId: references.worktreeId,
      path: filePath,
      kind: 'file',
    })
  }
  if (folderPath !== undefined && folderPath !== '') {
    if (references.projectId === undefined || references.worktreeId === undefined) {
      throw new Error(
        '--folder requires a Project and Worktree (pass --project-id and --worktree-id)',
      )
    }
    refs.push({
      projectId: references.projectId,
      worktreeId: references.worktreeId,
      path: folderPath,
      kind: 'folder',
    })
  }
  return refs
}

/** Resolve a UUID or a short id (`T-18`) against this daemon's table. */
export function findTask(id: string): Task | null {
  const tasks = readTasks()
  return (
    tasks.find((task) => task.id === id || task.shortId === id) ??
    (isTaskShortId(id) ? (tasks.find((task) => task.shortId === id) ?? null) : null)
  )
}

/** Returns null when no Task carries that id — the caller reports it, nothing is written. */
export function updateTask(
  id: string,
  fields: { title?: string; notes?: string; status?: TaskStatus; tags?: string[] },
): Task | null {
  const tasks = readTasks()
  const existing = findTask(id)
  if (existing === null) return null

  const next: Task = { ...existing, updatedAt: new Date().toISOString() }
  if (fields.title !== undefined) {
    const title = fields.title.trim()
    if (title === '') throw new Error('title is required')
    next.title = title
  }
  if (fields.notes !== undefined) next.notes = fields.notes
  if (fields.status !== undefined) next.status = fields.status
  if (fields.tags !== undefined) next.tags = fields.tags

  writeTasks(tasks.map((task) => (task.id === existing.id ? next : task)))
  return next
}
