import type { ProjectPath, ProjectSummary } from '@porcelain/client-runtime/projects'
import type {
  BrowseDirsOutput,
  CreateHubWorktreeInput,
  HubInventory,
  HubWorktree,
  RemoveHubProjectInput,
  RemoveHubWorktreeInput,
} from '@porcelain/contracts/projects'
import { projectsProcedures } from '@porcelain/contracts/projects'

import type { trpcClient } from '@renderer/lib/trpc'

type ProjectsClient = Pick<
  typeof trpcClient,
  | 'browseDirs'
  | 'openRepoPath'
  | 'recentRepos'
  | 'removeRecentRepo'
  | 'hubInventory'
  | 'createHubWorktree'
  | 'removeHubProject'
  | 'removeHubWorktree'
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

/** Remove a Hub Project from the daemon inventory and recent paths. */
export async function removeHubProjectOnDaemon(
  client: ProjectsClient,
  projectId: RemoveHubProjectInput,
): Promise<void> {
  projectsProcedures.removeHubProject.output.parse(await client.removeHubProject.mutate(projectId))
}

/** Remove one linked Worktree from Git through the Hub Projects boundary. */
export async function removeHubWorktreeOnDaemon(
  client: ProjectsClient,
  input: RemoveHubWorktreeInput,
): Promise<void> {
  projectsProcedures.removeHubWorktree.output.parse(await client.removeHubWorktree.mutate(input))
}

/** Browse the daemon's filesystem with a nullable Project-directory root. */
export async function browseProjectDirectoriesOnDaemon(
  client: ProjectsClient,
  path: string | null,
): Promise<BrowseDirsOutput> {
  return projectsProcedures.browseDirs.output.parse(await client.browseDirs.query(path))
}

/** Read this Environment daemon's live Hub inventory. */
export async function hubInventoryOnDaemon(client: ProjectsClient): Promise<HubInventory> {
  return projectsProcedures.hubInventory.output.parse(await client.hubInventory.query())
}

/** Create a Git Worktree for a Hub Project and return its stable identity. */
export async function createHubWorktreeOnDaemon(
  client: ProjectsClient,
  input: CreateHubWorktreeInput,
): Promise<HubWorktree> {
  return projectsProcedures.createHubWorktree.output.parse(
    await client.createHubWorktree.mutate(input),
  )
}
