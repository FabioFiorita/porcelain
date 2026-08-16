import { reviewedPathsQuerySchema } from '@porcelain/client-runtime/review'
import { z } from 'zod'

/** Programmer error for an invalid Git project identity. */
export class GitIdentityError extends Error {
  override readonly name = 'GitIdentityError'
}

const projectPathSchema = z.string().min(1)
const pathDimensionSchema = z.string()
const limitSchema = z.number().int().positive()

/** Keep the project dimension shared by every Git identity. */
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

const gitDiffFileQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('diff-file'),
    projectPath: projectPathSchema,
    filePath: pathDimensionSchema,
  })
  .strict()

const gitRangeDiffFileQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('range-diff-file'),
    projectPath: projectPathSchema,
    base: pathDimensionSchema,
    filePath: pathDimensionSchema,
  })
  .strict()

const gitCommitDiffQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('commit-diff'),
    projectPath: projectPathSchema,
    hash: pathDimensionSchema,
    filePath: pathDimensionSchema,
  })
  .strict()

const diffReadingScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('working') }).strict(),
  z.object({ type: z.literal('branch') }).strict(),
  z.object({ type: z.literal('commit'), hash: pathDimensionSchema }).strict(),
])

export type DiffReadingScope = Readonly<z.infer<typeof diffReadingScopeSchema>>

const gitDiffReadingQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('diff-reading'),
    projectPath: projectPathSchema,
    scope: diffReadingScopeSchema,
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
    limit: limitSchema,
  })
  .strict()

const gitFileLogQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('file-log'),
    projectPath: projectPathSchema,
    filePath: pathDimensionSchema,
    limit: limitSchema,
  })
  .strict()

const gitCommitMessageQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('commit-message'),
    projectPath: projectPathSchema,
    hash: pathDimensionSchema,
  })
  .strict()

const gitCommitFlowQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('commit-flow'),
    projectPath: projectPathSchema,
    hash: pathDimensionSchema,
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

const gitCommitModelsQuerySchema = z
  .object({
    domain: z.literal('git'),
    name: z.literal('commit-models'),
  })
  .strict()

/** Exact server-state identities. Family effects are deliberately not query keys. */
export const gitQuerySchema = z.discriminatedUnion('name', [
  gitHeadQuerySchema,
  gitFlowQuerySchema,
  gitRangeFlowQuerySchema,
  gitStatusQuerySchema,
  gitDiffFileQuerySchema,
  gitRangeDiffFileQuerySchema,
  gitCommitDiffQuerySchema,
  gitDiffReadingQuerySchema,
  gitBranchesQuerySchema,
  gitWorktreesQuerySchema,
  gitLogQuerySchema,
  gitFileLogQuerySchema,
  gitCommitMessageQuerySchema,
  gitCommitFlowQuerySchema,
  gitCommitConventionsQuerySchema,
  gitSuggestionsQuerySchema,
  gitCommitModelsQuerySchema,
])

/** Exact identities used by workspace adapters, including the existing Review workspace reads. */
export const gitWorkspaceQuerySchema = z.discriminatedUnion('name', [
  gitHeadQuerySchema,
  gitFlowQuerySchema,
  gitRangeFlowQuerySchema,
  gitStatusQuerySchema,
  gitDiffFileQuerySchema,
  gitRangeDiffFileQuerySchema,
  gitCommitDiffQuerySchema,
  gitDiffReadingQuerySchema,
  gitBranchesQuerySchema,
  gitWorktreesQuerySchema,
  gitLogQuerySchema,
  gitFileLogQuerySchema,
  gitCommitMessageQuerySchema,
  gitCommitFlowQuerySchema,
  gitCommitConventionsQuerySchema,
  gitSuggestionsQuerySchema,
  gitCommitModelsQuerySchema,
  reviewedPathsQuerySchema,
])

export type GitQuery = Readonly<z.infer<typeof gitQuerySchema>>
export type GitWorkspaceQuery = Readonly<z.infer<typeof gitWorkspaceQuerySchema>>

export type GitHeadQuery = Readonly<z.infer<typeof gitHeadQuerySchema>>
export type GitFlowQuery = Readonly<z.infer<typeof gitFlowQuerySchema>>
export type GitRangeFlowQuery = Readonly<z.infer<typeof gitRangeFlowQuerySchema>>
export type GitStatusQuery = Readonly<z.infer<typeof gitStatusQuerySchema>>
export type GitDiffFileQuery = Readonly<z.infer<typeof gitDiffFileQuerySchema>>
export type GitRangeDiffFileQuery = Readonly<z.infer<typeof gitRangeDiffFileQuerySchema>>
export type GitCommitDiffQuery = Readonly<z.infer<typeof gitCommitDiffQuerySchema>>
export type GitDiffReadingQuery = Readonly<z.infer<typeof gitDiffReadingQuerySchema>>
export type GitBranchesQuery = Readonly<z.infer<typeof gitBranchesQuerySchema>>
export type GitWorktreesQuery = Readonly<z.infer<typeof gitWorktreesQuerySchema>>
export type GitLogQuery = Readonly<z.infer<typeof gitLogQuerySchema>>
export type GitFileLogQuery = Readonly<z.infer<typeof gitFileLogQuerySchema>>
export type GitCommitMessageQuery = Readonly<z.infer<typeof gitCommitMessageQuerySchema>>
export type GitCommitFlowQuery = Readonly<z.infer<typeof gitCommitFlowQuerySchema>>
export type GitCommitConventionsQuery = Readonly<z.infer<typeof gitCommitConventionsQuerySchema>>
export type GitSuggestionsQuery = Readonly<z.infer<typeof gitSuggestionsQuerySchema>>
export type GitCommitModelsQuery = Readonly<z.infer<typeof gitCommitModelsQuerySchema>>

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

export function gitDiffFileQuery(projectPath: string, filePath: string): GitDiffFileQuery {
  return {
    domain: 'git',
    name: 'diff-file',
    projectPath: gitProjectKey(projectPath),
    filePath,
  }
}

export function gitRangeDiffFileQuery(
  projectPath: string,
  base: string,
  filePath: string,
): GitRangeDiffFileQuery {
  return {
    domain: 'git',
    name: 'range-diff-file',
    projectPath: gitProjectKey(projectPath),
    base,
    filePath,
  }
}

export function gitCommitDiffQuery(
  projectPath: string,
  hash: string,
  filePath: string,
): GitCommitDiffQuery {
  return {
    domain: 'git',
    name: 'commit-diff',
    projectPath: gitProjectKey(projectPath),
    hash,
    filePath,
  }
}

export function gitDiffReadingQuery(
  projectPath: string,
  scope: DiffReadingScope,
): GitDiffReadingQuery {
  return {
    domain: 'git',
    name: 'diff-reading',
    projectPath: gitProjectKey(projectPath),
    scope,
  }
}

export function gitBranchesQuery(projectPath: string): GitBranchesQuery {
  return { domain: 'git', name: 'branches', projectPath: gitProjectKey(projectPath) }
}

export function gitWorktreesQuery(projectPath: string): GitWorktreesQuery {
  return { domain: 'git', name: 'worktrees', projectPath: gitProjectKey(projectPath) }
}

export function gitLogQuery(projectPath: string, limit = 200): GitLogQuery {
  return { domain: 'git', name: 'log', projectPath: gitProjectKey(projectPath), limit }
}

export function gitFileLogQuery(
  projectPath: string,
  filePath: string,
  limit = 50,
): GitFileLogQuery {
  return {
    domain: 'git',
    name: 'file-log',
    projectPath: gitProjectKey(projectPath),
    filePath,
    limit,
  }
}

export function gitCommitMessageQuery(projectPath: string, hash: string): GitCommitMessageQuery {
  return { domain: 'git', name: 'commit-message', projectPath: gitProjectKey(projectPath), hash }
}

export function gitCommitFlowQuery(projectPath: string, hash: string): GitCommitFlowQuery {
  return { domain: 'git', name: 'commit-flow', projectPath: gitProjectKey(projectPath), hash }
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

export function gitCommitModelsQuery(): GitCommitModelsQuery {
  return { domain: 'git', name: 'commit-models' }
}
