import { z } from 'zod'

/** Programmer error for an invalid Git project identity. */
export class GitIdentityError extends Error {
  override readonly name = 'GitIdentityError'
}

const projectPathSchema = z.string().min(1)

/** Keep the project dimension shared by every Git and workspace Review identity. */
export function gitProjectKey(projectPath: string): string {
  const parsed = projectPathSchema.safeParse(projectPath)
  if (!parsed.success) throw new GitIdentityError('git: project path must be non-empty')
  return parsed.data
}

const gitHeadQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('head'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitFlowQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('flow'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitRangeFlowQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('range-flow'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitStatusQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('status'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitDiffQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('diff'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitBranchesQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('branches'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitWorktreesQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('worktrees'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitLogQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('log'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitCommitConventionsQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('commit-conventions'),
    projectPath: projectPathSchema,
  })
  .strict()

const gitSuggestionsQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('suggestions'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewReadingQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('reading'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewViewQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('view'),
    projectPath: projectPathSchema,
  })
  .strict()

const reviewedPathsQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('reviewed-paths'),
    projectPath: projectPathSchema,
  })
  .strict()

const worktreeInboxQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('worktree-inbox'),
    projectPath: projectPathSchema,
  })
  .strict()

export type GitHeadQuery = Readonly<z.infer<typeof gitHeadQuerySchema>>
export type GitFlowQuery = Readonly<z.infer<typeof gitFlowQuerySchema>>
export type GitRangeFlowQuery = Readonly<z.infer<typeof gitRangeFlowQuerySchema>>
export type GitStatusQuery = Readonly<z.infer<typeof gitStatusQuerySchema>>
export type GitDiffQuery = Readonly<z.infer<typeof gitDiffQuerySchema>>
export type GitBranchesQuery = Readonly<z.infer<typeof gitBranchesQuerySchema>>
export type GitWorktreesQuery = Readonly<z.infer<typeof gitWorktreesQuerySchema>>
export type GitLogQuery = Readonly<z.infer<typeof gitLogQuerySchema>>
export type GitCommitConventionsQuery = Readonly<z.infer<typeof gitCommitConventionsQuerySchema>>
export type GitSuggestionsQuery = Readonly<z.infer<typeof gitSuggestionsQuerySchema>>
export type ReviewReadingQuery = Readonly<z.infer<typeof reviewReadingQuerySchema>>
export type ReviewViewQuery = Readonly<z.infer<typeof reviewViewQuerySchema>>
export type ReviewedPathsQuery = Readonly<z.infer<typeof reviewedPathsQuerySchema>>
export type WorktreeInboxQuery = Readonly<z.infer<typeof worktreeInboxQuerySchema>>

export const gitQuerySchema = z.discriminatedUnion('name', [
  gitHeadQuerySchema,
  gitFlowQuerySchema,
  gitRangeFlowQuerySchema,
  gitStatusQuerySchema,
  gitDiffQuerySchema,
  gitBranchesQuerySchema,
  gitWorktreesQuerySchema,
  gitLogQuerySchema,
  gitCommitConventionsQuerySchema,
  gitSuggestionsQuerySchema,
])

export const reviewWorkspaceQuerySchema = z.discriminatedUnion('name', [
  reviewReadingQuerySchema,
  reviewViewQuerySchema,
  reviewedPathsQuerySchema,
  worktreeInboxQuerySchema,
])

export const gitWorkspaceQuerySchema = z.discriminatedUnion('name', [
  gitHeadQuerySchema,
  gitFlowQuerySchema,
  gitRangeFlowQuerySchema,
  gitStatusQuerySchema,
  gitDiffQuerySchema,
  gitBranchesQuerySchema,
  gitWorktreesQuerySchema,
  gitLogQuerySchema,
  gitCommitConventionsQuerySchema,
  gitSuggestionsQuerySchema,
  reviewReadingQuerySchema,
  reviewViewQuerySchema,
  reviewedPathsQuerySchema,
  worktreeInboxQuerySchema,
])

export type GitQuery = Readonly<z.infer<typeof gitQuerySchema>>
export type ReviewWorkspaceQuery = Readonly<z.infer<typeof reviewWorkspaceQuerySchema>>
export type GitWorkspaceQuery = Readonly<z.infer<typeof gitWorkspaceQuerySchema>>

export function gitHeadQuery(projectPath: string): GitHeadQuery {
  return { domain: 'git', name: 'head', projectPath: gitProjectKey(projectPath) }
}

export function gitFlowQuery(projectPath: string): GitFlowQuery {
  return { domain: 'git', name: 'flow', projectPath: gitProjectKey(projectPath) }
}

export function gitRangeFlowQuery(projectPath: string): GitRangeFlowQuery {
  return { domain: 'git', name: 'range-flow', projectPath: gitProjectKey(projectPath) }
}

export function gitStatusQuery(projectPath: string): GitStatusQuery {
  return { domain: 'git', name: 'status', projectPath: gitProjectKey(projectPath) }
}

/** Semantic project family for the per-file `gitDiffFile` wire queries. */
export function gitDiffQuery(projectPath: string): GitDiffQuery {
  return { domain: 'git', name: 'diff', projectPath: gitProjectKey(projectPath) }
}

export function gitBranchesQuery(projectPath: string): GitBranchesQuery {
  return { domain: 'git', name: 'branches', projectPath: gitProjectKey(projectPath) }
}

export function gitWorktreesQuery(projectPath: string): GitWorktreesQuery {
  return { domain: 'git', name: 'worktrees', projectPath: gitProjectKey(projectPath) }
}

export function gitLogQuery(projectPath: string): GitLogQuery {
  return { domain: 'git', name: 'log', projectPath: gitProjectKey(projectPath) }
}

export function gitCommitConventionsQuery(projectPath: string): GitCommitConventionsQuery {
  return {
    domain: 'git',
    name: 'commit-conventions',
    projectPath: gitProjectKey(projectPath),
  }
}

export function gitSuggestionsQuery(projectPath: string): GitSuggestionsQuery {
  return { domain: 'git', name: 'suggestions', projectPath: gitProjectKey(projectPath) }
}

export function reviewReadingQuery(projectPath: string): ReviewReadingQuery {
  return { domain: 'review', name: 'reading', projectPath: gitProjectKey(projectPath) }
}

export function reviewViewQuery(projectPath: string): ReviewViewQuery {
  return { domain: 'review', name: 'view', projectPath: gitProjectKey(projectPath) }
}

export function reviewedPathsQuery(projectPath: string): ReviewedPathsQuery {
  return { domain: 'review', name: 'reviewed-paths', projectPath: gitProjectKey(projectPath) }
}

export function worktreeInboxQuery(projectPath: string): WorktreeInboxQuery {
  return { domain: 'review', name: 'worktree-inbox', projectPath: gitProjectKey(projectPath) }
}
