import type { TaskRow } from './tasks-rows'

/**
 * Free-text matching for a Tasks board.
 *
 * It lives in client-runtime rather than in one app because two clients now filter the same
 * rows: the web Viewer's Tasks table and the mobile Tasks board. What counts as a hit is the
 * product decision — every token must land somewhere in the row, and the statuses are spelled
 * out so "in progress" finds a `doing` Task — and a second hand-maintained copy is how a filter
 * that finds a Task on the desktop but not on the phone gets shipped.
 *
 * Pure on purpose: rows go straight in, so the rule is testable without a daemon, a query
 * client, or a DOM.
 *
 * `extraHaystack` is how a client contributes a field only it can name. The phone lists Tasks
 * from every paired Environment at once and lets you type the Environment's label to narrow
 * them; the Viewer is already inside one, so it has nothing to add. That is a difference in
 * what the two boards SHOW, not a difference in the rule, so it is a parameter rather than a
 * second copy.
 */

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
  extraHaystack: readonly string[] = [],
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
    ...extraHaystack,
  ]
    .join('\n')
    .toLowerCase()
  return query.split(/\s+/).every((token) => haystack.includes(token))
}
