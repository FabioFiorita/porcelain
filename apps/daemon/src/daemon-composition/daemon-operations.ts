import type { SessionChange } from '@porcelain/contracts/session'
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
import type { ProjectsOperations } from '../features/projects'
import { createReviewCommentOperations, type ReviewCommentOperations } from '../features/review'
import { createSearchOperations, type SearchOperations } from '../features/search'
import type { TerminalOperations } from '../features/terminal'
import { gitGrep, gitListSearchFiles, gitSearchCode } from '../git/git'
import { publishSessionChange } from '../session/live-session'
import { hiddenPathsForRepo } from '../stores/scope-store'

/**
 * Process-wide bound operation catalog constructed once at daemon startup.
 * Each domain migration adds a required non-optional property and converts its
 * router factory to receive that narrow slice in the same change.
 */
export type DaemonOperations = Readonly<{
  board: BoardOperations
  reviewComments: ReviewCommentOperations
  files: FilesOperations
  git: GitOperations
  search: SearchOperations
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
    board: createBoardOperations({
      publishSessionChange: publish,
    }),
    reviewComments: createReviewCommentOperations({
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
    projects: options.projects,
    terminal: options.terminal,
  })
}
