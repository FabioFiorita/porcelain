import type { HubEnvironmentInventory } from '@/features/projects'

/**
 * The two labels a Task row prints that the wire does not carry.
 *
 * The free-text filter itself is not here: `taskMatchesQuery` is shared with Web and lives in
 * `@porcelain/client-runtime/tasks`, so a query that finds a Task on the desktop finds it on
 * the phone too.
 */

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
