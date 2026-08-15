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
      args: '--title <s> [--notes <s>] [--status todo|doing|done|blocked] [--tags a,b] [--link <url>] [--link-label <s>] [--attach <abs path>] [--project-id <s>] [--worktree-id <s>]',
      desc: 'Create a Task (references default to the current checkout)',
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
    'project-id':
      'Project the Task points at (default: the Project this checkout belongs to, when Porcelain knows it)',
    'worktree-id': 'Worktree the Task points at; requires --project-id',
  },
}

const TASK_STATUSES = ['todo', 'doing', 'done', 'blocked'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

type TaskReferences = { projectId?: string; worktreeId?: string }
type TaskLink = { url: string; label: string }
export type TaskAttachment = {
  id: string
  name: string
  storedPath: string
  byteSize: number
  mime: string
}

export type Task = {
  id: string
  title: string
  notes?: string
  status: TaskStatus
  tags: string[]
  references: TaskReferences
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

  const id = randomUUID()
  const now = new Date().toISOString()
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
    title,
    status: options.status ?? 'todo',
    tags: options.tags ?? [],
    references,
    attachments,
    links,
    createdAt: now,
    updatedAt: now,
  }
  if (options.notes !== undefined && options.notes !== '') task.notes = options.notes

  writeTasks([...readTasks(), task])
  return task
}

/** Returns null when no Task carries that id — the caller reports it, nothing is written. */
export function updateTask(
  id: string,
  fields: { title?: string; notes?: string; status?: TaskStatus; tags?: string[] },
): Task | null {
  const tasks = readTasks()
  const existing = tasks.find((task) => task.id === id)
  if (existing === undefined) return null

  const next: Task = { ...existing, updatedAt: new Date().toISOString() }
  if (fields.title !== undefined) {
    const title = fields.title.trim()
    if (title === '') throw new Error('title is required')
    next.title = title
  }
  if (fields.notes !== undefined) next.notes = fields.notes
  if (fields.status !== undefined) next.status = fields.status
  if (fields.tags !== undefined) next.tags = fields.tags

  writeTasks(tasks.map((task) => (task.id === id ? next : task)))
  return next
}

export function describeTasks(tasks: Task[]): string {
  if (tasks.length === 0) {
    return 'No Tasks on this daemon yet. Run `tasks add --title "…"`.'
  }
  const lines = [`Tasks on this daemon (${tasks.length}):`]
  for (const task of tasks) {
    const tags = task.tags.length === 0 ? '' : ` [${task.tags.join(', ')}]`
    const extras: string[] = []
    if (task.attachments.length > 0) extras.push(`${task.attachments.length} attachment(s)`)
    if (task.links.length > 0) extras.push(`${task.links.length} link(s)`)
    const suffix = extras.length === 0 ? '' : ` — ${extras.join(', ')}`
    lines.push(`- [${task.id}] (${task.status}) ${task.title}${tags}${suffix}`)
  }
  return lines.join('\n')
}

function requiredStatus(raw: string | undefined): TaskStatus | undefined {
  if (raw === undefined || raw === '') return undefined
  const status = normalizeTaskStatus(raw)
  if (status === null) throw new Error(`status must be one of ${TASK_STATUSES.join('|')}`)
  return status
}

function present(flags: Map<string, string>, name: string): string | undefined {
  const value = flags.get(name)
  return value === undefined || value === '' ? undefined : value
}

function required(flags: Map<string, string>, name: string): string {
  const value = present(flags, name)
  if (value === undefined) throw new Error(`${name} is required`)
  return value
}

/** cli.ts's whole `tasks` dispatch, pulled in to keep that shrink-only file lean. */
export function describeTasksCommand(
  verb: string,
  repoPath: string,
  flags: Map<string, string>,
): string {
  if (verb === 'list') return describeTasks(readTasks())
  if (verb === 'add') {
    const linkUrl = present(flags, 'link')
    const task = createTask({
      repoPath,
      title: required(flags, 'title'),
      notes: present(flags, 'notes'),
      status: requiredStatus(present(flags, 'status')),
      tags: normalizeTags(present(flags, 'tags')),
      projectId: present(flags, 'project-id'),
      worktreeId: present(flags, 'worktree-id'),
      link:
        linkUrl === undefined ? undefined : { url: linkUrl, label: present(flags, 'link-label') },
      attachPath: present(flags, 'attach'),
    })
    const where =
      task.references.projectId === undefined
        ? 'no Project reference (this checkout is not registered with Porcelain)'
        : `Project ${task.references.projectId}`
    return `Created Task ${task.id} "${task.title}" (${task.status}) — ${where}`
  }
  const id = required(flags, 'id')
  if (verb === 'done') {
    return updateTask(id, { status: 'done' }) === null
      ? `No Task ${id} on this daemon`
      : `Marked Task ${id} done`
  }
  const rawTags = present(flags, 'tags')
  const updated = updateTask(id, {
    title: present(flags, 'title'),
    notes: present(flags, 'notes'),
    status: requiredStatus(present(flags, 'status')),
    tags: rawTags === undefined ? undefined : normalizeTags(rawTags),
  })
  return updated === null ? `No Task ${id} on this daemon` : `Updated Task ${id}`
}
