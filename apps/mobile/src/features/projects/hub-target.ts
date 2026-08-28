import { type HubTarget, hubInventoryQuery } from '@porcelain/client-runtime/projects'
import type { HubInventory } from '@porcelain/contracts/projects'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  activeProjectPathOf,
  type Environment,
  isEnabled,
  isPaired,
  useActiveEnvironment,
  useEnvironments,
} from '@/features/remote'
import { hubInventoryProcedure } from './project-procedures'
import { callProjectDaemon } from './use-project-transport'

/**
 * Mobile's Hub binding.
 *
 * The web client keeps a persisted `HubSelection` because its tree selects Projects and
 * Worktrees directly. Mobile still selects a checkout *path*, persisted per Environment as
 * `activeRepoPath` — so the path is authoritative and synchronous, and the Hub inventory is
 * consulted only to join that path onto the stable Project + Worktree identity the daemon owns.
 * Mobile never mints its own identity: an unmatched path yields `null`.
 */

/** The cache identity the Hub inventory is read under. */
export function hubInventoryKey(
  environmentId: string,
): readonly ['daemon', string, ReturnType<typeof hubInventoryQuery>] {
  return ['daemon', environmentId, hubInventoryQuery()] as const
}

/** The live Hub inventory for the active Environment, or null before it resolves. */
export function useHubInventory(): HubInventory | null {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const enabled =
    isEnabled(environment) && isPaired(environment) && activeProjectPathOf(environment) !== null
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<HubInventory> =>
      callProjectDaemon(environment, hubInventoryProcedure, undefined),
    queryKey: hubInventoryKey(environmentId),
  })
  return query.data ?? null
}

/** Join a checkout path onto the Environment's Project + Worktree records. */
export function hubTargetIn(inventory: HubInventory, path: string): HubTarget | null {
  for (const project of inventory.projects) {
    const worktree = project.worktrees.find((entry) => entry.path === path)
    if (worktree === undefined) continue
    return {
      environmentId: inventory.environment.id,
      projectId: project.id,
      worktreeId: worktree.id,
      path: worktree.path,
    }
  }
  return null
}

/**
 * The selected Worktree as an explicit Environment + Project + Worktree target.
 *
 * Null until the inventory resolves, so it is the identity for anything that *needs* the
 * stable ids — never the source of `repoPath`, which stays synchronous (`useHubRepoPath`).
 */
export function useHubTarget(): HubTarget | null {
  const environment = useActiveEnvironment()
  const inventory = useHubInventory()
  const path = activeProjectPathOf(environment)
  if (inventory === null || path === null) return null
  return hubTargetIn(inventory, path)
}

/**
 * The selected checkout path — what every daemon procedure takes as `repoPath`.
 *
 * Read straight off the persisted Environment record: available on the first render of a cold
 * start, before any daemon round trip. The single seam the shell rewrite replaces.
 */
export function useHubRepoPath(): string | null {
  return activeProjectPathOf(useActiveEnvironment())
}

/** One Environment's Hub inventory, joined to the local pairing record that produced it. */
export type HubEnvironmentInventory = {
  readonly environment: Environment
  readonly inventory: HubInventory
}

/**
 * Every paired Environment's Hub inventory at once.
 *
 * The Hub list is cross-Environment by definition — a Worktree's Environment is a label on the
 * row, never a filter — so it cannot be built on `useHubInventory`, which is scoped to the
 * active Environment and gated on a selected checkout. This one is gated on pairing alone, so a
 * cold start with nothing selected still has a list to show.
 */
export function useHubInventories(): readonly HubEnvironmentInventory[] {
  const environments = useEnvironments()
  const paired = environments.filter(isEnabled).filter(isPaired)
  const results = useQueries({
    queries: paired.map((environment) => ({
      queryFn: async (): Promise<HubInventory> =>
        callProjectDaemon(environment, hubInventoryProcedure, undefined),
      queryKey: hubInventoryKey(environment.id),
      staleTime: 30_000,
    })),
  })
  return paired.flatMap((environment, index) => {
    const inventory = results[index]?.data
    return inventory === undefined ? [] : [{ environment, inventory }]
  })
}
