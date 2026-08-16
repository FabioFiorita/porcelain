export {
  createCommitGeneration,
  createGitChangesPublisher,
  createGitDiffReadingSources,
  createProjectGit,
  createWorkingTreeCache,
  createWorkspaceTrash,
} from './git-adapters'
export {
  createGitOperations,
  type GitOperationDependencies,
  type GitOperations,
} from './git-operations'
export type {
  CommitGeneration,
  GitChanges,
  GitDiffReadingSources,
  GitProjectError,
  GitProjectResult,
  GitWorkspaceError,
  GitWorkspacePort,
  GitWorkspaceResult,
  ProjectGit,
  WorkingTreeCache,
  WorkspaceTrash,
} from './git-ports'
export { createGitFeatureRouter } from './git-router'
export {
  createGitSubprocess,
  type GitExecute,
  type GitExecuteOptions,
  type GitSubprocessHost,
} from './git-subprocess'
