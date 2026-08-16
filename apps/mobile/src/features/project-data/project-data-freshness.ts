import {
  projectDataDispositionsQuery,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateProjectDataIdentities } from './project-data-query-key'

export type ApplyProjectDataFreshnessOptions = {
  readonly queryClient: QueryClient
  readonly environmentId: string
}

/** Project-scoped recovery invalidates both identities for that path. */
export function applyProjectDataFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: ApplyProjectDataFreshnessOptions,
): Promise<void> {
  if (requirement.scope.kind !== 'project') return Promise.resolve()
  const projectPath = requirement.scope.projectPath
  return invalidateProjectDataIdentities(options.queryClient, options.environmentId, [
    projectDataDispositionsQuery(projectPath),
    projectDataVisibilityQuery(projectPath),
  ])
}
