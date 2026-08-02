import type { HeadRef } from '@porcelain/contracts'
import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

const fileStatusSchema = z.enum(['modified', 'added', 'deleted', 'renamed', 'untracked'])

/**
 * `staged`/`unstaged` are only set for working-tree reads — a commit's file list has no staging
 * state — so both stay optional and a missing one means "not applicable", never "false".
 */
const flowFileSchema = z.object({
  path: z.string(),
  status: fileStatusSchema,
  staged: z.boolean().optional(),
  unstaged: z.boolean().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  connects: z.array(z.string()),
})

const flowGroupSchema = z.object({ layer: z.string(), files: z.array(flowFileSchema) })

const diffLineSchema = z.object({
  kind: z.enum(['context', 'add', 'del']),
  oldLine: z.number().nullable(),
  newLine: z.number().nullable(),
  text: z.string(),
})

const diffHunkSchema = z.object({ header: z.string(), lines: z.array(diffLineSchema) })

const readingFileSchema = z.object({
  path: z.string(),
  status: fileStatusSchema.optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  hunks: z.array(diffHunkSchema).optional(),
})

/**
 * `diffReading` also carries `sections`, `evidence` and the rest of the Review's document model.
 * They are not parsed here because Changes reads the flow-grouped files and nothing else — the
 * Review tab owns that half of the shape, and parsing it twice is how two clients drift.
 */
const featureReadingSchema = z.object({
  name: z.string(),
  groups: z.array(z.object({ layer: z.string(), files: z.array(readingFileSchema) })),
})

export type FlowFile = z.infer<typeof flowFileSchema>
export type FlowGroup = z.infer<typeof flowGroupSchema>
export type FileStatus = z.infer<typeof fileStatusSchema>
export type DiffHunk = z.infer<typeof diffHunkSchema>
export type FeatureReading = z.infer<typeof featureReadingSchema>

export const gitFlowQuery = defineQuery<string, FlowGroup[]>('gitFlow', z.array(flowGroupSchema))

export const reviewedPathsQuery = defineQuery<string, string[]>(
  'reviewedPaths',
  z.array(z.string()),
)

export const gitHeadQuery = defineQuery<string, HeadRef>(
  'gitHead',
  z.object({ branch: z.string().nullable(), detachedSha: z.string().nullable() }),
)

export const gitLogQuery = defineQuery<
  { repoPath: string; limit: number },
  { hash: string; author: string; date: string; subject: string }[]
>(
  'gitLog',
  z.array(
    z.object({
      hash: z.string(),
      author: z.string(),
      date: z.string(),
      subject: z.string(),
    }),
  ),
)

/** The daemon returns the raw `%B` body, so the subject is this string's first line. */
export const gitCommitMessageQuery = defineQuery<{ repoPath: string; hash: string }, string>(
  'gitCommitMessage',
  z.string(),
)

export const gitCommitFlowQuery = defineQuery<{ repoPath: string; hash: string }, FlowGroup[]>(
  'gitCommitFlow',
  z.array(flowGroupSchema),
)

const diffFileResultSchema = z.object({
  hunks: z.array(diffHunkSchema),
  status: fileStatusSchema,
  image: z.object({ dataUrl: z.string() }).optional(),
  binary: z.boolean().optional(),
})

export type DiffFileResult = z.infer<typeof diffFileResultSchema>

export const gitDiffFileQuery = defineQuery<{ repoPath: string; filePath: string }, DiffFileResult>(
  'gitDiffFile',
  diffFileResultSchema,
)

/** Unlike `gitDiffFile`, the commit form returns the hunks bare — no status, no image. */
export const gitCommitDiffQuery = defineQuery<
  { repoPath: string; hash: string; filePath: string },
  DiffHunk[]
>('gitCommitDiff', z.array(diffHunkSchema))

export type DiffReadingScope = { type: 'working' } | { type: 'commit'; hash: string }

export const diffReadingQuery = defineQuery<
  { repoPath: string; scope: DiffReadingScope },
  FeatureReading
>('diffReading', featureReadingSchema)

const commitConventionsSchema = z.object({
  scopes: z.array(z.string()),
  types: z.array(z.string()),
})
const gitSuggestionSchema = z.object({ command: z.string(), reason: z.string() })

export type CommitConventions = z.infer<typeof commitConventionsSchema>
export type GitSuggestion = z.infer<typeof gitSuggestionSchema>

export const QUICK_COMMANDS = ['status', 'pull', 'push', 'fetch', 'stash', 'stash-pop'] as const
export type QuickCommandId = (typeof QUICK_COMMANDS)[number]

export const gitCommitConventionsQuery = defineQuery<string, CommitConventions>(
  'gitCommitConventions',
  commitConventionsSchema,
)

export const gitSuggestionsQuery = defineQuery<string, GitSuggestion[]>(
  'gitSuggestions',
  z.array(gitSuggestionSchema),
)

export const gitStageAllMutation = defineMutation<{ repoPath: string }, void>(
  'gitStageAll',
  z.void(),
)

export const gitUnstageAllMutation = defineMutation<{ repoPath: string }, void>(
  'gitUnstageAll',
  z.void(),
)

export const gitStageFileMutation = defineMutation<{ repoPath: string; path: string }, void>(
  'gitStageFile',
  z.void(),
)

export const gitUnstageFileMutation = defineMutation<{ repoPath: string; path: string }, void>(
  'gitUnstageFile',
  z.void(),
)

export const gitDiscardFileMutation = defineMutation<{ repoPath: string; path: string }, void>(
  'gitDiscardFile',
  z.void(),
)

export const gitCommitMutation = defineMutation<{ repoPath: string; message: string }, void>(
  'gitCommit',
  z.void(),
)

export const gitPushMutation = defineMutation<{ repoPath: string }, string>('gitPush', z.string())

export const gitQuickCommandMutation = defineMutation<
  { repoPath: string; command: QuickCommandId; pullMode: 'merge' | 'rebase' },
  string
>('gitQuickCommand', z.string())

export const markReviewedMutation = defineMutation<{ repoPath: string; path: string }, void>(
  'markReviewed',
  z.void(),
)

export const unmarkReviewedMutation = defineMutation<{ repoPath: string; path: string }, void>(
  'unmarkReviewed',
  z.void(),
)

export const setReviewedMutation = defineMutation<{ repoPath: string; paths: string[] }, void>(
  'setReviewed',
  z.void(),
)
