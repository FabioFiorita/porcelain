import {
  type FilesQueryEffect,
  filesExactEffect,
  filesPinsQuery,
  filesProjectKey,
  filesTreeSubtreeEffect,
} from '@porcelain/client-runtime/files'
import {
  reviewedPathsQuery,
  reviewReadingQuery,
  reviewViewQuery,
  worktreeInboxQuery,
} from '@porcelain/client-runtime/review'
import {
  type GitAddWorktreeInput,
  type GitCheckoutInput,
  type GitCommitInput,
  type GitCreateBranchInput,
  type GitDiscardFileInput,
  type GitGenerateCommitGroupsInput,
  type GitGenerateCommitMessageInput,
  type GitPushInput,
  type GitQuickCommandInput,
  type GitStageAllInput,
  type GitStageFileInput,
  type GitUnstageAllInput,
  type GitUnstageFileInput,
  gitProcedures,
} from '@porcelain/contracts/git'
import {
  gitBranchesQuery,
  gitCommitConventionsQuery,
  gitDiffReadingQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitProjectKey,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
  gitWorktreesQuery,
} from './git-queries'
import {
  dedupeGitQueryEffects,
  type GitQueryEffect,
  gitDiffQuery,
  gitFileLogQueryFamily,
  gitLogQueryFamily,
  gitRangeDiffQuery,
} from './git-query-effects'

type GitMutationName =
  | 'gitQuickCommand'
  | 'gitPush'
  | 'gitStageAll'
  | 'gitUnstageAll'
  | 'gitStageFile'
  | 'gitUnstageFile'
  | 'gitDiscardFile'
  | 'gitCommit'
  | 'gitGenerateCommitMessage'
  | 'gitGenerateCommitGroups'
  | 'gitCheckout'
  | 'gitCreateBranch'
  | 'gitAddWorktree'

export type GitMutationDefinition<TName extends GitMutationName, TInput> = {
  readonly procedure: (typeof gitProcedures)[TName]
  readonly procedureName: TName
  readonly affectedQueries: (input: TInput) => readonly GitQueryEffect[]
  readonly filesEffects: (input: TInput) => readonly FilesQueryEffect[]
  readonly optimistic: false
  readonly requiresAuthoritativeRefetch: true
}

function projectQueries(projectPath: string): readonly GitQueryEffect[] {
  const key = gitProjectKey(projectPath)
  return [
    gitHeadQuery(key),
    gitFlowQuery(key),
    gitRangeFlowQuery(key),
    gitStatusQuery(key),
    gitDiffQuery(key),
    gitRangeDiffQuery(key),
    gitDiffReadingQuery(key, { type: 'working' }),
    gitDiffReadingQuery(key, { type: 'branch' }),
    gitBranchesQuery(key),
    gitWorktreesQuery(key),
    gitLogQueryFamily(key),
    gitFileLogQueryFamily(key),
    gitCommitConventionsQuery(key),
    gitSuggestionsQuery(key),
    reviewReadingQuery(key),
    reviewViewQuery(key),
    reviewedPathsQuery(key),
    worktreeInboxQuery(key),
  ]
}

function workingTreeQueries(projectPath: string): readonly GitQueryEffect[] {
  const key = gitProjectKey(projectPath)
  return [
    gitFlowQuery(key),
    gitStatusQuery(key),
    gitDiffQuery(key),
    gitDiffReadingQuery(key, { type: 'working' }),
    gitSuggestionsQuery(key),
  ]
}

function historyQueries(projectPath: string): readonly GitQueryEffect[] {
  const key = gitProjectKey(projectPath)
  return [
    gitHeadQuery(key),
    gitRangeFlowQuery(key),
    gitRangeDiffQuery(key),
    gitLogQueryFamily(key),
    gitFileLogQueryFamily(key),
    gitCommitConventionsQuery(key),
    gitSuggestionsQuery(key),
    reviewReadingQuery(key),
    reviewViewQuery(key),
    reviewedPathsQuery(key),
  ]
}

function commitQueries(projectPath: string): readonly GitQueryEffect[] {
  const key = gitProjectKey(projectPath)
  return dedupeGitQueryEffects([
    ...workingTreeQueries(key),
    gitDiffReadingQuery(key, { type: 'branch' }),
    ...historyQueries(key),
  ])
}

function noFilesEffects<TInput>(_input: TInput): readonly FilesQueryEffect[] {
  return []
}

function discardFilesEffects(input: GitDiscardFileInput): readonly FilesQueryEffect[] {
  const projectPath = filesProjectKey(input.repoPath)
  return [
    filesTreeSubtreeEffect(projectPath, input.path),
    filesExactEffect(filesPinsQuery(projectPath)),
  ]
}

function quickCommandQueries(input: GitQuickCommandInput): readonly GitQueryEffect[] {
  const key = gitProjectKey(input.repoPath)
  switch (input.command) {
    case 'status':
      return []
    case 'fetch':
      return [
        gitHeadQuery(key),
        gitRangeFlowQuery(key),
        gitBranchesQuery(key),
        gitLogQueryFamily(key),
        gitSuggestionsQuery(key),
      ]
    case 'pull':
      return commitQueries(key)
    case 'push':
      return historyQueries(key)
    case 'stash':
    case 'stash-pop':
      return workingTreeQueries(key)
    default: {
      const _exhaustive: never = input.command
      return _exhaustive
    }
  }
}

export const gitMutations = {
  quickCommand: {
    procedure: gitProcedures.gitQuickCommand,
    procedureName: 'gitQuickCommand',
    affectedQueries: quickCommandQueries,
    filesEffects: noFilesEffects<GitQuickCommandInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  push: {
    procedure: gitProcedures.gitPush,
    procedureName: 'gitPush',
    affectedQueries: (input: GitPushInput): readonly GitQueryEffect[] =>
      historyQueries(input.repoPath),
    filesEffects: noFilesEffects<GitPushInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  stageAll: {
    procedure: gitProcedures.gitStageAll,
    procedureName: 'gitStageAll',
    affectedQueries: (input: GitStageAllInput): readonly GitQueryEffect[] =>
      workingTreeQueries(input.repoPath),
    filesEffects: noFilesEffects<GitStageAllInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  unstageAll: {
    procedure: gitProcedures.gitUnstageAll,
    procedureName: 'gitUnstageAll',
    affectedQueries: (input: GitUnstageAllInput): readonly GitQueryEffect[] =>
      workingTreeQueries(input.repoPath),
    filesEffects: noFilesEffects<GitUnstageAllInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  stageFile: {
    procedure: gitProcedures.gitStageFile,
    procedureName: 'gitStageFile',
    affectedQueries: (input: GitStageFileInput): readonly GitQueryEffect[] =>
      workingTreeQueries(input.repoPath),
    filesEffects: noFilesEffects<GitStageFileInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  unstageFile: {
    procedure: gitProcedures.gitUnstageFile,
    procedureName: 'gitUnstageFile',
    affectedQueries: (input: GitUnstageFileInput): readonly GitQueryEffect[] =>
      workingTreeQueries(input.repoPath),
    filesEffects: noFilesEffects<GitUnstageFileInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  discardFile: {
    procedure: gitProcedures.gitDiscardFile,
    procedureName: 'gitDiscardFile',
    affectedQueries: (input: GitDiscardFileInput): readonly GitQueryEffect[] =>
      workingTreeQueries(input.repoPath),
    filesEffects: discardFilesEffects,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  commit: {
    procedure: gitProcedures.gitCommit,
    procedureName: 'gitCommit',
    affectedQueries: (input: GitCommitInput): readonly GitQueryEffect[] =>
      commitQueries(input.repoPath),
    filesEffects: noFilesEffects<GitCommitInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  generateMessage: {
    procedure: gitProcedures.gitGenerateCommitMessage,
    procedureName: 'gitGenerateCommitMessage',
    affectedQueries: (_input: GitGenerateCommitMessageInput): readonly GitQueryEffect[] => [],
    filesEffects: noFilesEffects<GitGenerateCommitMessageInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  generateGroups: {
    procedure: gitProcedures.gitGenerateCommitGroups,
    procedureName: 'gitGenerateCommitGroups',
    affectedQueries: (_input: GitGenerateCommitGroupsInput): readonly GitQueryEffect[] => [],
    filesEffects: noFilesEffects<GitGenerateCommitGroupsInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  checkout: {
    procedure: gitProcedures.gitCheckout,
    procedureName: 'gitCheckout',
    affectedQueries: (input: GitCheckoutInput): readonly GitQueryEffect[] =>
      projectQueries(input.repoPath),
    filesEffects: noFilesEffects<GitCheckoutInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  createBranch: {
    procedure: gitProcedures.gitCreateBranch,
    procedureName: 'gitCreateBranch',
    affectedQueries: (input: GitCreateBranchInput): readonly GitQueryEffect[] =>
      projectQueries(input.repoPath),
    filesEffects: noFilesEffects<GitCreateBranchInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  addWorktree: {
    procedure: gitProcedures.gitAddWorktree,
    procedureName: 'gitAddWorktree',
    affectedQueries: (input: GitAddWorktreeInput): readonly GitQueryEffect[] => {
      const key = gitProjectKey(input.repoPath)
      return [gitBranchesQuery(key), gitWorktreesQuery(key), worktreeInboxQuery(key)]
    },
    filesEffects: noFilesEffects<GitAddWorktreeInput>,
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly quickCommand: GitMutationDefinition<'gitQuickCommand', GitQuickCommandInput>
  readonly push: GitMutationDefinition<'gitPush', GitPushInput>
  readonly stageAll: GitMutationDefinition<'gitStageAll', GitStageAllInput>
  readonly unstageAll: GitMutationDefinition<'gitUnstageAll', GitUnstageAllInput>
  readonly stageFile: GitMutationDefinition<'gitStageFile', GitStageFileInput>
  readonly unstageFile: GitMutationDefinition<'gitUnstageFile', GitUnstageFileInput>
  readonly discardFile: GitMutationDefinition<'gitDiscardFile', GitDiscardFileInput>
  readonly commit: GitMutationDefinition<'gitCommit', GitCommitInput>
  readonly generateMessage: GitMutationDefinition<
    'gitGenerateCommitMessage',
    GitGenerateCommitMessageInput
  >
  readonly generateGroups: GitMutationDefinition<
    'gitGenerateCommitGroups',
    GitGenerateCommitGroupsInput
  >
  readonly checkout: GitMutationDefinition<'gitCheckout', GitCheckoutInput>
  readonly createBranch: GitMutationDefinition<'gitCreateBranch', GitCreateBranchInput>
  readonly addWorktree: GitMutationDefinition<'gitAddWorktree', GitAddWorktreeInput>
}

export type GitMutation = (typeof gitMutations)[keyof typeof gitMutations]
