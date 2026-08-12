import { openProject, removeRecentProject } from '@porcelain/client-runtime/projects'
import { projectsProcedures } from '@porcelain/contracts/projects'

import { type Environment, isPaired, type PairedEnvironment } from '@/lib/daemon/environment'
import { DaemonError } from '@/lib/daemon/errors'
import { namedContractProcedure } from '@/lib/daemon/procedure'

export const recentProjectsProcedure = namedContractProcedure(
  'recentRepos',
  projectsProcedures.recentRepos,
)
export const openProjectProcedure = namedContractProcedure(
  openProject.procedureName,
  openProject.procedure,
)
export const removeRecentProjectProcedure = namedContractProcedure(
  removeRecentProject.procedureName,
  removeRecentProject.procedure,
)
export const browseDirectoriesProcedure = namedContractProcedure(
  'browseDirs',
  projectsProcedures.browseDirs,
)

export function pairedProjectEnvironment(
  environment: Environment | null,
  procedure: string,
): PairedEnvironment {
  if (!isPaired(environment)) {
    throw new DaemonError('unreachable', procedure, 'No daemon is paired.')
  }
  return environment
}
