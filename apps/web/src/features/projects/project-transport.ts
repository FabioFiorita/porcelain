import type { ProjectPath, ProjectSummary } from '@porcelain/client-runtime/projects'
import type {
  BrowseDirsOutput,
  CanvasRecord,
  CreateHubWorktreeInput,
  HubInventory,
  HubWorktree,
  ListOverlayOutput,
  ProjectOverrides,
  PromoteCanvasInput,
  PromoteCanvasOutput,
  PromoteOverridesInput,
  ReadCanvasOutput,
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
  | 'listCanvases'
  | 'readCanvas'
  | 'mintCanvasAccessToken'
  | 'promoteCanvas'
  | 'promoteOverrides'
  | 'listOverlay'
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

/**
 * List the Canvases recorded for one Project, newest-updated first. With
 * `worktreePath` the addressed checkout's tracked overlay is merged over the
 * private records (tracked wins on the same id); without it only private
 * records are listed.
 */
export async function listCanvasesOnDaemon(
  client: ProjectsClient,
  projectId: string,
  worktreePath?: string,
): Promise<readonly CanvasRecord[]> {
  return projectsProcedures.listCanvases.output.parse(
    await client.listCanvases.query({ projectId, worktreePath }),
  )
}

/** Read one Canvas — HTML content is already server-inlined (images/CSS/scripts). */
export async function readCanvasOnDaemon(
  client: ProjectsClient,
  input: { projectId: string; canvasId: string; worktreePath?: string },
): Promise<ReadCanvasOutput> {
  return projectsProcedures.readCanvas.output.parse(await client.readCanvas.query(input))
}

/** Mint the short-lived token the sandboxed Canvas iframe's GET /canvas/<token> needs. */
export async function mintCanvasAccessTokenOnDaemon(
  client: ProjectsClient,
  input: { projectId: string; canvasId: string; worktreePath?: string },
): Promise<string> {
  const result = projectsProcedures.mintCanvasAccessToken.output.parse(
    await client.mintCanvasAccessToken.mutate(input),
  )
  return result.token
}

/**
 * Promote one private Canvas into the explicitly addressed checkout's Git
 * overlay. `path` is never guessed by the daemon: a path that is not a live
 * Worktree of this Project is rejected (`projects.overlay-target-invalid`).
 */
export async function promoteCanvasOnDaemon(
  client: ProjectsClient,
  input: PromoteCanvasInput,
): Promise<PromoteCanvasOutput> {
  return projectsProcedures.promoteCanvas.output.parse(await client.promoteCanvas.mutate(input))
}

/** Track the current project defaults into the addressed checkout's `.porcelain/`. */
export async function promoteOverridesOnDaemon(
  client: ProjectsClient,
  input: PromoteOverridesInput,
): Promise<ProjectOverrides> {
  return projectsProcedures.promoteOverrides.output.parse(
    await client.promoteOverrides.mutate(input),
  )
}

/** Read what one checkout's tracked `.porcelain/` overlay currently carries. */
export async function listOverlayOnDaemon(
  client: ProjectsClient,
  path: string,
): Promise<ListOverlayOutput> {
  return projectsProcedures.listOverlay.output.parse(await client.listOverlay.query({ path }))
}
