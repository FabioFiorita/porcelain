import type { EnvironmentIdentity, HubInventory, HubProject } from '@porcelain/contracts/projects'

export type HubInventorySource = Readonly<{
  online: boolean
  inventory: HubInventory | null
}>

export type HubProjectMember = Readonly<{
  environment: EnvironmentIdentity
  project: HubProject
}>

export type HubProjectGroup = Readonly<{
  groupingKey: string
  name: string
  members: readonly HubProjectMember[]
}>

/** Drop offline Environments and missing payloads so the live Hub never shows stale children. */
export function visibleHubInventories(
  sources: readonly HubInventorySource[],
): readonly HubInventory[] {
  return sources.flatMap((source) =>
    source.online && source.inventory !== null ? [source.inventory] : [],
  )
}

/**
 * Group equivalent Projects across Environments without merging their records.
 * Members stay Environment-local; only the grouping key is shared.
 */
export function groupEquivalentProjects(
  inventories: readonly HubInventory[],
): readonly HubProjectGroup[] {
  const groups = new Map<string, HubProjectGroup>()
  for (const inventory of inventories) {
    for (const project of inventory.projects) {
      const existing = groups.get(project.groupingKey)
      const member = { environment: inventory.environment, project }
      if (existing === undefined) {
        groups.set(project.groupingKey, {
          groupingKey: project.groupingKey,
          name: project.name,
          members: [member],
        })
        continue
      }
      groups.set(project.groupingKey, {
        ...existing,
        members: [...existing.members, member],
      })
    }
  }
  return [...groups.values()]
}
