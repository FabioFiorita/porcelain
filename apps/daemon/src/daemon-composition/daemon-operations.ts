import type { SessionChange } from '@porcelain/contracts/session'
import { realpath } from 'node:fs/promises'
import {
  type ActionsOperations,
  type ActionsProjects,
  createActionsOperations,
  createJsonActionsStore,
  createJsonActionTrustStore,
} from '../features/actions'
import {
  createFilesOperations,
  createFilesScope,
  type FilePreviewTokens,
  type FilesOperations,
} from '../features/files'
import {
  createCommitGeneration,
  createGitChangesPublisher,
  createGitDiffReadingSources,
  createGitOperations,
  createGitSubprocess,
  createProjectGit,
  createWorkingTreeCache,
  createWorkspaceTrash,
  type GitOperations,
} from '../features/git'
import { createProjectDataOperations, type ProjectDataOperations } from '../features/project-data'
import type { ProjectsOperations } from '../features/projects'
import {
  accessSnapshot,
  cloudflareStatus,
  createRemoteOperations,
  ifaceListenerPort,
  issuePairingGrant,
  lanBindError,
  lanNumericUrl,
  lanUrl,
  loadConfig,
  type RemoteOperations,
  revokeAuthorizedClient,
  revokePairingGrant,
  startCloudflare,
  startLanListener,
  startTailnetListener,
  stopCloudflare,
  stopLanListener,
  stopTailnetListener,
  tailnetBindError,
  tailnetUrl,
  updateConfig,
} from '../features/remote'
import { createReviewOperations, type ReviewOperations } from '../features/review'
import { createSearchOperations, type SearchOperations } from '../features/search'
import type { TerminalOperations } from '../features/terminal'
import { gitGrep, gitListSearchFiles, gitSearchCode } from '../git/git'
import { displayAdminTokenPath } from '../net/admin-token'
import { daemonIdentity } from '../net/daemon-identity'
import { daemonVersion } from '../net/daemon-version'
import {
  clientSessionCount,
  closeClientSessions,
  publishSessionChange,
} from '../session/live-session'
import { reviewLayersForRepo } from '../stores/review-store'
import { createScopeStore, type RepoIdentity } from '../stores/scope-store'

/**
 * Process-wide bound operation catalog constructed once at daemon startup.
 * Each canonical domain contributes a required non-optional property, and its
 * router factory receives only that narrow slice.
 */
export type DaemonOperations = Readonly<{
  remote: RemoteOperations
  actions: ActionsOperations
  review: ReviewOperations
  files: FilesOperations
  git: GitOperations
  search: SearchOperations
  projectData: ProjectDataOperations
  projects: ProjectsOperations
  terminal: TerminalOperations
}>

/** Canonical spelling for checkout ownership (`/var` and `/private/var` are aliases on macOS). */
export async function canonicalCheckoutPath(path: string): Promise<string> {
  return realpath(path).catch(() => path)
}

export interface CreateDaemonRouterOptions {
  operations: DaemonOperations
}

/**
 * Actions asks the Projects domain — through one narrow read — which checkouts this
 * Environment currently has for a Project, so an explicit run target can be verified
 * instead of trusted. Actions never enumerates Worktrees itself.
 */
function actionsProjectsCapability(projects: ProjectsOperations): ActionsProjects {
  return {
    async listWorktreePaths(projectId) {
      const inventory = await projects.listHubInventory()
      if (!inventory.ok) return { ok: false, error: { code: 'actions.unavailable' } }
      const project = inventory.value.projects.find((entry) => entry.id === projectId)
      return { ok: true, value: project?.worktrees.map((worktree) => worktree.path) ?? [] }
    },
  }
}

export function createDaemonOperations(options: {
  projects: ProjectsOperations
  terminal: TerminalOperations
  /** Resolved `porcelainHome()` — the daemon-root Project store lives beneath it. */
  homeDir: string
  /** Shared capability grants for GET /file-preview/<token> (file-preview-http.ts). */
  filePreviewTokens?: FilePreviewTokens
  publishSessionChange?: (change: SessionChange) => void
}): DaemonOperations {
  const publish = options.publishSessionChange ?? publishSessionChange
  // The profile store needs BOTH halves of a checkout's Hub identity: the Project
  // owns the baseline document, the Worktree keys its optional override.
  const identityForRepo = async (repoPath: string): Promise<RepoIdentity | null> => {
    const inventory = await options.projects.listHubInventory()
    if (!inventory.ok) return null
    const canonicalRepoPath = await canonicalCheckoutPath(repoPath)
    for (const project of inventory.value.projects) {
      for (const worktree of project.worktrees) {
        if (
          worktree.path === repoPath ||
          worktree.path === canonicalRepoPath ||
          (await canonicalCheckoutPath(worktree.path)) === canonicalRepoPath
        ) {
          return { projectId: project.id, worktreeId: worktree.id }
        }
      }
    }
    return null
  }
  const scope = createScopeStore({ homeDir: options.homeDir, identityForRepo })
  const filesScope = createFilesScope({ homeDir: options.homeDir, identityForRepo })
  return Object.freeze({
    remote: createRemoteOperations({
      access: {
        snapshot: accessSnapshot,
        issuePairingGrant,
        revokePairingGrant,
        revokeAuthorizedClient,
      },
      identity: daemonIdentity,
      version: daemonVersion,
      displayAdminTokenPath,
      sessions: { clientSessionCount, closeClientSessions },
      config: { load: loadConfig, update: updateConfig },
      listeners: {
        tailnetUrl,
        tailnetBindError,
        startTailnetListener,
        stopTailnetListener,
        lanUrl,
        lanNumericUrl,
        lanBindError,
        startLanListener,
        stopLanListener,
        ifaceListenerPort,
      },
      cloudflare: { status: cloudflareStatus, start: startCloudflare, stop: stopCloudflare },
      env: {
        tailnetBindForced: () => process.env.PORCELAIN_TAILNET_BIND === '1',
        lanBindForced: () => process.env.PORCELAIN_LAN_BIND === '1',
        cloudflareBindForced: () => process.env.PORCELAIN_CLOUDFLARE_BIND === '1',
      },
    }),
    actions: createActionsOperations({
      sources: [{ kind: 'private', store: createJsonActionsStore({ homeDir: options.homeDir }) }],
      trustStore: createJsonActionTrustStore(),
      projects: actionsProjectsCapability(options.projects),
      publishSessionChange: publish,
    }),
    review: createReviewOperations({
      publishSessionChange: publish,
    }),
    files: createFilesOperations({
      scope: filesScope,
      publishSessionChange: publish,
      // The entry point owns the ONE token store the GET /file-preview route resolves
      // against; a default instance here would mint grants nothing can redeem.
      ...(options.filePreviewTokens === undefined
        ? {}
        : { previewTokens: options.filePreviewTokens }),
    }),
    git: createGitOperations({
      workspace: createGitSubprocess(),
      projectGit: createProjectGit(),
      commitGeneration: createCommitGeneration(),
      workspaceTrash: createWorkspaceTrash(),
      workingTreeCache: createWorkingTreeCache(),
      changes: createGitChangesPublisher(publish),
      diffReadingSources: createGitDiffReadingSources({
        review: { layersForRepo: reviewLayersForRepo },
      }),
    }),
    search: createSearchOperations({
      git: {
        listFiles: gitListSearchFiles,
        searchText: gitGrep,
        searchCode: gitSearchCode,
      },
      scope: { hiddenPaths: scope.hiddenPathsForRepo },
    }),
    projectData: createProjectDataOperations(),
    projects: options.projects,
    terminal: options.terminal,
  })
}
