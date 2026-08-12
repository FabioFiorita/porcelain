import type { ProjectPath, ProjectSummary } from '@porcelain/client-runtime/projects'
import {
  activeEnvironment,
  activeProjectPathOf,
  type Environment,
  environmentActions,
  projectNameOf,
  useActiveEnvironment,
} from '@/features/remote'
import { daemonSession } from '@/lib/daemon/session'

import { openProjectProcedure, pairedProjectEnvironment } from './project-procedures'
import { callProjectDaemon } from './use-project-transport'

/** The active Project presentation derived from the environment selection adapter. */
export function useActiveProject(): ProjectSummary | null {
  const environment = useActiveEnvironment()
  return selectedProject(environment)
}

function selectedProject(environment: Environment | null): ProjectSummary | null {
  const path = activeProjectPathOf(environment)
  return path === null ? null : { name: projectNameOf(path), path }
}

/** Open a Project for non-React Git/shell callers and update the same selection boundary as hooks. */
export async function openProject(path: ProjectPath): Promise<void> {
  const environment = activeEnvironment()
  const project = await callProjectDaemon(environment, openProjectProcedure, path)
  const paired = pairedProjectEnvironment(environment, openProjectProcedure.name)
  await environmentActions.setActiveProjectPath(paired.id, project.path)
  daemonSession.selectProject(project.path)
}
