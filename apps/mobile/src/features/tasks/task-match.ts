import type { TaskRow } from '@porcelain/client-runtime/tasks'

import type { HubEnvironmentInventory } from '@/features/projects'

/**
 * Free-text matching and the two labels a row prints that the wire does not carry.
 *
 * Mirrored from `apps/web/src/features/tasks/task-match.ts` rather than shared, because the two
 * clients cannot import each other and this logic never reached `client-runtime`. Keep the
 * haystack in step with Web's when either moves — a filter that finds a Task on the desktop
 * and not on the phone is worse than one that finds neither.
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
    row.environmentName,
  ]
    .join('\n')
    .toLowerCase()
  return query.split(/\s+/).every((token) => haystack.includes(token))
}

/**
 * Project id → human name, across every paired Environment's inventory.
 *
 * A Task carries only `references.projectId`; the name lives on the Hub inventory, which is
 * why a row that belongs to an Environment this phone cannot currently reach falls back to
 * printing the raw id rather than inventing a name for it.
 */
export function projectNamesFrom(
  inventories: readonly HubEnvironmentInventory[],
): Record<string, string> {
  const names: Record<string, string> = {}
  for (const source of inventories) {
    for (const project of source.inventory.projects) names[project.id] = project.name
  }
  return names
}

/** Web's `formatWhen`, so the same Task reads the same on both clients. */
export function formatWhen(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
