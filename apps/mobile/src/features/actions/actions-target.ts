import type { ActionRunTarget } from '@porcelain/contracts/actions'
import { projectsProcedures } from '@porcelain/contracts/projects'
import { useQuery } from '@tanstack/react-query'
import { useActiveProject } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { callActionsProcedure } from './use-actions-transport'

/**
 * Resolve the active checkout into the explicit Environment + Project + Worktree an
 * Action needs (#24).
 *
 * The phone knows a path; the daemon knows which stable Project and Worktree that path
 * belongs to. Reading the Hub inventory is how the two are joined — mobile never mints
 * its own identity, and an unmatched path yields `null` so nothing runs on a guess.
 */

const hubInventoryProcedure = namedContractProcedure(
  'hubInventory',
  projectsProcedures.hubInventory,
)

export function useActionsTarget(): ActionRunTarget | null {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const projectPath = project?.path ?? null

  const query = useQuery({
    enabled: projectPath !== null && isPaired(environment),
    queryKey: ['daemon', environment?.id ?? 'none', { domain: 'projects', name: 'hubInventory' }],
    queryFn: async () => callActionsProcedure(environment, hubInventoryProcedure, undefined),
  })

  const inventory = query.data
  if (inventory === undefined || projectPath === null) return null
  for (const hubProject of inventory.projects) {
    const worktree = hubProject.worktrees.find((entry) => entry.path === projectPath)
    if (worktree === undefined) continue
    return {
      environmentId: inventory.environment.id,
      projectId: hubProject.id,
      worktreeId: worktree.id,
      path: worktree.path,
    }
  }
  return null
}
