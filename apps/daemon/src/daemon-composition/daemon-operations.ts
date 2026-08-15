import type { SessionChange } from '@porcelain/contracts/session'
import {
  type ActionsOperations,
  type ActionsProjects,
  createActionsOperations,
  createJsonActionsStore,
  createJsonActionTrustStore,
} from '../features/actions'
import { type BoardOperations, createBoardOperations } from '../features/board'
import { createFilesOperations, type FilesOperations } from '../features/files'
import {
  createCommitGeneration,
  createGitChangesPublisher,
  createGitDiffReadingSources,
  createGitOperations,
  createGitSubprocess,
  createProjectGit,
  createReviewMarks,
  createWorkingTreeCache,
  createWorkspaceTrash,
  type GitOperations,
} from '../features/git'
import {
  createCompanionMigration,
  createProjectDataOperations,
  type MigrationWorktrees,
  type ProjectDataOperations,
} from '../features/project-data'
import type { ProjectsOperations } from '../features/projects'
import {
  accessSnapshot,
  createRemoteOperations,
  funnelStatus,
  ifaceListenerPort,
  issuePairingGrant,
  lanBindError,
  lanNumericUrl,
  lanUrl,
  loadConfig,
  type RemoteOperations,
  revokeAuthorizedClient,
  revokePairingGrant,
  startFunnel,
  startLanListener,
  startTailnetListener,
  stopFunnel,
  stopLanListener,
  stopTailnetListener,
  tailnetBindError,
  tailnetUrl,
  updateConfig,
} from '../features/remote'
import { createReviewOperations, type ReviewOperations } from '../features/review'
import { createSearchOperations, type SearchOperations } from '../features/search'
import {
  createTasksOperations,
  type TasksAttachments,
  type TasksOperations,
  type TasksStore,
} from '../features/tasks'
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
import { hiddenPathsForRepo } from '../stores/scope-store'

/**
 * Process-wide bound operation catalog constructed once at daemon startup.
 * Each canonical domain contributes a required non-optional property, and its
 * router factory receives only that narrow slice.
 */
export type DaemonOperations = Readonly<{
  remote: RemoteOperations
  board: BoardOperations
  tasks: TasksOperations
  actions: ActionsOperations
  review: ReviewOperations
  files: FilesOperations
  git: GitOperations
  search: SearchOperations
  projectData: ProjectDataOperations
  projects: ProjectsOperations
  terminal: TerminalOperations
}>

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

/**
 * The live Worktrees of one Project, for the companion migration's explicit
 * target check. Same inventory the Actions capability above reads — one source
 * of truth for "is this path really a checkout of this Project".
 */
function migrationWorktreesCapability(projects: ProjectsOperations): MigrationWorktrees {
  return {
    async listWorktrees(projectId) {
      const inventory = await projects.listHubInventory()
      if (!inventory.ok) return { ok: false }
      const project = inventory.value.projects.find((entry) => entry.id === projectId)
      if (project === undefined) return { ok: false }
      return {
        ok: true,
        value: project.worktrees.map((worktree) => ({ id: worktree.id, path: worktree.path })),
      }
    },
  }
}

export function createDaemonOperations(options: {
  projects: ProjectsOperations
  /** Daemon-root Tasks adapters; only the entry point may resolve `$PORCELAIN_HOME`. */
  tasks: { store: TasksStore; attachments: TasksAttachments }
  terminal: TerminalOperations
  /** Resolved `porcelainHome()` — the daemon-root Project store lives beneath it. */
  homeDir: string
  publishSessionChange?: (change: SessionChange) => void
}): DaemonOperations {
  const publish = options.publishSessionChange ?? publishSessionChange
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
      funnel: { status: funnelStatus, start: startFunnel, stop: stopFunnel },
      env: {
        tailnetBindForced: () => process.env.PORCELAIN_TAILNET_BIND === '1',
        lanBindForced: () => process.env.PORCELAIN_LAN_BIND === '1',
        funnelBindForced: () => process.env.PORCELAIN_FUNNEL_BIND === '1',
      },
    }),
    board: createBoardOperations({
      publishSessionChange: publish,
    }),
    tasks: createTasksOperations({
      store: options.tasks.store,
      attachments: options.tasks.attachments,
      publishSessionChange: publish,
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
    files: createFilesOperations({ publishSessionChange: publish }),
    git: createGitOperations({
      workspace: createGitSubprocess(),
      projectGit: createProjectGit(),
      commitGeneration: createCommitGeneration(),
      workspaceTrash: createWorkspaceTrash(),
      reviewMarks: createReviewMarks(),
      workingTreeCache: createWorkingTreeCache(),
      changes: createGitChangesPublisher(publish),
      diffReadingSources: createGitDiffReadingSources(),
    }),
    search: createSearchOperations({
      git: {
        listFiles: gitListSearchFiles,
        searchText: gitGrep,
        searchCode: gitSearchCode,
      },
      scope: { hiddenPaths: hiddenPathsForRepo },
    }),
    projectData: createProjectDataOperations({
      migration: createCompanionMigration({
        homeDir: options.homeDir,
        worktrees: migrationWorktreesCapability(options.projects),
      }),
    }),
    projects: options.projects,
    terminal: options.terminal,
  })
}
