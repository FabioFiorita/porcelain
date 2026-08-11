import { getDaemonClient } from './client'
import { isPaired, repoNameOf } from './environment'
import { activeEnvironment, environmentActions, useActiveEnvironment } from './environments-store'
import { callDaemon } from './procedure'
import { openRepoPathMutation } from './procedures/connection'
import { daemonSession } from './session'

/** The repo the active daemon is pointed at. Its name is derived — the path is what is stored. */
export function useActiveRepo(): { path: string; name: string } | null {
  const environment = useActiveEnvironment()
  const path = environment?.activeRepoPath ?? null
  return path === null ? null : { name: repoNameOf(path), path }
}

/**
 * `openRepoPath` is load-bearing daemon-side: it records the recent, seeds worktree settings
 * and warms the file cache. Always call it when switching repo — never just store the path.
 */
export async function openRepo(path: string): Promise<void> {
  const environment = activeEnvironment()
  if (!isPaired(environment)) return
  const repo = await callDaemon(getDaemonClient(environment), openRepoPathMutation, path)
  await environmentActions.setActiveRepoPath(environment.id, repo.path)
  // Interests are project-scoped: declare the project on the live session without tearing the
  // socket down (a reconnect would drop every attached terminal).
  daemonSession.selectProject(repo.path)
}
