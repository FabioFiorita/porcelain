import type { TaskRow } from '@porcelain/client-runtime/tasks'

const STATUS_WORDS: Readonly<Record<string, string>> = {
  todo: 'to do todo',
  doing: 'doing in progress',
  done: 'done complete',
  blocked: 'blocked',
}

/** True when the query hits any field a person might be thinking of. */
export function taskMatchesQuery(
  row: TaskRow,
  rawQuery: string,
  projectNames: Readonly<Record<string, string>>,
): boolean {
  const query = rawQuery.trim().toLowerCase()
  if (query === '') return true
  const projectId = row.task.references.projectId
  const haystack = [
    row.task.shortId,
    row.task.id,
    row.task.title,
    row.task.notes ?? '',
    row.task.status,
    STATUS_WORDS[row.task.status] ?? '',
    ...row.task.tags,
    projectId ?? '',
    projectId === undefined ? '' : (projectNames[projectId] ?? ''),
    row.task.references.worktreeId ?? '',
    ...row.task.pathRefs.map((ref) => `${ref.kind} ${ref.path}`),
    ...row.task.attachments.map((attachment) => attachment.name),
    ...row.task.links.map((link) => `${link.label} ${link.url}`),
  ]
    .join('\n')
    .toLowerCase()
  return query.split(/\s+/).every((token) => haystack.includes(token))
}
