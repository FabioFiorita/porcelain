import type { ProjectPath, ProjectSummary } from '@porcelain/client-runtime/projects'
import type { BrowseDirsOutput } from '@porcelain/contracts/projects'
import { projectsProcedures } from '@porcelain/contracts/projects'

import type { trpcClient } from '@renderer/lib/trpc'

type ProjectsClient = Pick<
  typeof trpcClient,
  'browseDirs' | 'openRepoPath' | 'recentRepos' | 'removeRecentRepo'
>

/** Read the daemon's authoritative Project summary through the Projects boundary. */
export async function openProjectOnDaemon(
  client: ProjectsClient,
  projectPath: ProjectPath,
): Promise<ProjectSummary> {
  return projectsProcedures.openRepoPath.output.parse(await client.openRepoPath.mutate(projectPath))
}

/** Read recent Projects; the worktree flag remains part of the stable daemon request. */
export async function recentProjectsOnDaemon(
  client: ProjectsClient,
  includeWorktrees: boolean,
): Promise<readonly ProjectSummary[]> {
  const input = includeWorktrees ? { includeWorktrees: true } : undefined
  return projectsProcedures.recentRepos.output.parse(await client.recentRepos.query(input))
}

/** Remove a recent Project through the stable daemon procedure. */
export async function removeRecentProjectOnDaemon(
  client: ProjectsClient,
  projectPath: ProjectPath,
): Promise<void> {
  projectsProcedures.removeRecentRepo.output.parse(
    await client.removeRecentRepo.mutate(projectPath),
  )
}

/** Browse the daemon's filesystem with a nullable Project-directory root. */
export async function browseProjectDirectoriesOnDaemon(
  client: ProjectsClient,
  path: string | null,
): Promise<BrowseDirsOutput> {
  return projectsProcedures.browseDirs.output.parse(await client.browseDirs.query(path))
}
