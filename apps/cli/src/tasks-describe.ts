import { porcelainHome } from '@shared/porcelain-home'
import { taskAttachmentPath } from '@shared/tasks-porcelain'
import {
  createTask,
  findTask,
  normalizeTags,
  normalizeTaskStatus,
  readTasks,
  type Task,
  type TaskStatus,
  updateTask,
} from './tasks-file'

const TASK_STATUSES = ['todo', 'doing', 'done', 'blocked'] as const

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
    lines.push(`- ${task.shortId} [${task.id}] (${task.status}) ${task.title}${tags}${suffix}`)
  }
  return lines.join('\n')
}

function describeTask(task: Task): string {
  const lines = [`${task.shortId}  ${task.title}`, `id: ${task.id}`, `status: ${task.status}`]
  if (task.notes !== undefined && task.notes !== '') lines.push(`notes:\n${task.notes}`)
  if (task.tags.length > 0) lines.push(`tags: ${task.tags.join(', ')}`)
  if (task.references.projectId !== undefined) {
    lines.push(
      task.references.worktreeId === undefined
        ? `project: ${task.references.projectId}`
        : `project: ${task.references.projectId}  worktree: ${task.references.worktreeId}`,
    )
  }
  for (const ref of task.pathRefs) {
    lines.push(`${ref.kind}: ${ref.path}`)
  }
  for (const attachment of task.attachments) {
    lines.push(`attachment: ${taskAttachmentPath(porcelainHome(), attachment.storedPath)}`)
  }
  for (const link of task.links) {
    lines.push(`link: ${link.label} ${link.url}`)
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
      filePath: present(flags, 'file'),
      folderPath: present(flags, 'folder'),
    })
    const where =
      task.references.projectId === undefined
        ? 'no Project reference (this checkout is not registered with Porcelain)'
        : `Project ${task.references.projectId}`
    return `Created Task ${task.shortId} ${task.id} "${task.title}" (${task.status}) — ${where}`
  }
  const id = required(flags, 'id')
  if (verb === 'get') {
    const found = findTask(id)
    return found === null ? `No Task ${id} on this daemon` : describeTask(found)
  }
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
