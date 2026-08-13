import type { SessionChange } from '@porcelain/contracts/session'
import { type ActionsOperations, createActionsOperations } from '../features/actions'
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
import { createProjectDataOperations, type ProjectDataOperations } from '../features/project-data'
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
 * Each domain migration adds a required non-optional property and converts its
 * router factory to receive that narrow slice in the same change.
 */
export type DaemonOperations = Readonly<{
  remote: RemoteOperations
  board: BoardOperations
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

export function createDaemonOperations(options: {
  projects: ProjectsOperations
  terminal: TerminalOperations
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
    actions: createActionsOperations({
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
    projectData: createProjectDataOperations(),
    projects: options.projects,
    terminal: options.terminal,
  })
}
