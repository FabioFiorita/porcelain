import {
  type GitAddWorktreeInput,
  type GitCheckoutInput,
  type GitCreateBranchInput,
  gitProcedures,
} from '@porcelain/contracts/git'
import {
  type GitWorkspaceQuery,
  gitBranchesQuery,
  gitCommitConventionsQuery,
  gitDiffQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitProjectKey,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
  gitWorktreesQuery,
  reviewedPathsQuery,
  reviewReadingQuery,
  reviewViewQuery,
  worktreeInboxQuery,
} from './git-queries'

type GitWorkspaceMutationName = 'gitCheckout' | 'gitCreateBranch' | 'gitAddWorktree'

export type GitWorkspaceMutationDefinition<TName extends GitWorkspaceMutationName, TInput> = {
  readonly procedure: (typeof gitProcedures)[TName]
  readonly procedureName: TName
  readonly affectedQueries: (input: TInput) => readonly GitWorkspaceQuery[]
  readonly optimistic: false
  readonly requiresAuthoritativeRefetch: true
}

function checkoutQueries(projectPath: string): readonly GitWorkspaceQuery[] {
  const key = gitProjectKey(projectPath)
  return [
    gitHeadQuery(key),
    gitFlowQuery(key),
    gitRangeFlowQuery(key),
    gitStatusQuery(key),
    gitDiffQuery(key),
    gitBranchesQuery(key),
    gitWorktreesQuery(key),
    gitLogQuery(key),
    gitCommitConventionsQuery(key),
    gitSuggestionsQuery(key),
    reviewReadingQuery(key),
    reviewViewQuery(key),
    reviewedPathsQuery(key),
    worktreeInboxQuery(key),
  ]
}

function addWorktreeQueries(projectPath: string): readonly GitWorkspaceQuery[] {
  const key = gitProjectKey(projectPath)
  return [gitBranchesQuery(key), gitWorktreesQuery(key), worktreeInboxQuery(key)]
}

export const gitWorkspaceMutations = {
  checkout: {
    procedure: gitProcedures.gitCheckout,
    procedureName: 'gitCheckout',
    affectedQueries: (input: GitCheckoutInput): readonly GitWorkspaceQuery[] =>
      checkoutQueries(input.repoPath),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  createBranch: {
    procedure: gitProcedures.gitCreateBranch,
    procedureName: 'gitCreateBranch',
    affectedQueries: (input: GitCreateBranchInput): readonly GitWorkspaceQuery[] =>
      checkoutQueries(input.repoPath),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  addWorktree: {
    procedure: gitProcedures.gitAddWorktree,
    procedureName: 'gitAddWorktree',
    affectedQueries: (input: GitAddWorktreeInput): readonly GitWorkspaceQuery[] =>
      addWorktreeQueries(input.repoPath),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly checkout: GitWorkspaceMutationDefinition<'gitCheckout', GitCheckoutInput>
  readonly createBranch: GitWorkspaceMutationDefinition<'gitCreateBranch', GitCreateBranchInput>
  readonly addWorktree: GitWorkspaceMutationDefinition<'gitAddWorktree', GitAddWorktreeInput>
}

export type GitWorkspaceMutation =
  (typeof gitWorkspaceMutations)[keyof typeof gitWorkspaceMutations]
