import { z } from 'zod'
import {
  commitGroupGenerationGroupSchema,
  commitGroupGenerationOutputSchema,
  commitMessageGenerationInputSchema,
  commitMessageGenerationOutputSchema,
  commitModelOptionSchema,
} from '../commit-model'

export const fileStatusSchema = z.enum(['modified', 'added', 'deleted', 'renamed', 'untracked'])
export type FileStatus = z.infer<typeof fileStatusSchema>

export const changedFileSchema = z
  .object({
    path: z.string(),
    status: fileStatusSchema,
    staged: z.boolean().optional(),
    unstaged: z.boolean().optional(),
  })
  .strict()

export type ChangedFile = z.infer<typeof changedFileSchema>

export const flowFileSchema = changedFileSchema
  .extend({
    additions: z.number().optional(),
    deletions: z.number().optional(),
    connects: z.array(z.string()),
  })
  .strict()

export type FlowFile = z.infer<typeof flowFileSchema>

export const flowGroupSchema = z
  .object({
    layer: z.string(),
    files: z.array(flowFileSchema),
  })
  .strict()

export type FlowGroup = z.infer<typeof flowGroupSchema>

export const diffLineSchema = z
  .object({
    kind: z.enum(['context', 'add', 'del']),
    oldLine: z.number().nullable(),
    newLine: z.number().nullable(),
    text: z.string(),
  })
  .strict()

export type DiffLine = z.infer<typeof diffLineSchema>

export const diffHunkSchema = z
  .object({
    header: z.string(),
    lines: z.array(diffLineSchema),
  })
  .strict()

export type DiffHunk = z.infer<typeof diffHunkSchema>

export const diffFileResultSchema = z
  .object({
    hunks: z.array(diffHunkSchema),
    status: fileStatusSchema,
    image: z.object({ dataUrl: z.string() }).strict().optional(),
    binary: z.boolean().optional(),
  })
  .strict()

export type DiffFileResult = z.infer<typeof diffFileResultSchema>

export const headRefSchema = z
  .object({
    branch: z.string().nullable(),
    detachedSha: z.string().nullable(),
    /** `origin/main`-style tracking ref, or null when none is configured. */
    upstream: z.string().nullable(),
  })
  .strict()

export type GitHead = z.infer<typeof headRefSchema>

export const branchRefSchema = z
  .object({
    name: z.string(),
    remote: z.string().nullable(),
  })
  .strict()

export type BranchRef = z.infer<typeof branchRefSchema>

export const worktreeSchema = z
  .object({
    path: z.string(),
    branch: z.string(),
  })
  .strict()

export type Worktree = z.infer<typeof worktreeSchema>

export const commitSchema = z
  .object({
    hash: z.string(),
    author: z.string(),
    date: z.string(),
    subject: z.string(),
  })
  .strict()

export type Commit = z.infer<typeof commitSchema>

export const commitConventionsSchema = z
  .object({
    scopes: z.array(z.string()),
    types: z.array(z.string()),
  })
  .strict()

export type CommitConventions = z.infer<typeof commitConventionsSchema>

export const gitSuggestionSchema = z
  .object({
    command: z.string(),
    reason: z.string(),
  })
  .strict()

export type GitSuggestion = z.infer<typeof gitSuggestionSchema>

export const readingFileSchema = z
  .object({
    path: z.string(),
    source: z.literal('changed'),
    status: fileStatusSchema.optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    hunks: z.array(diffHunkSchema).optional(),
  })
  .strict()

export type ReadingFile = z.infer<typeof readingFileSchema>

const readingSectionSchema = z
  .object({
    title: z.string(),
    prose: z.string(),
    diagram: z.string().optional(),
    html: z.string().optional(),
    htmlHeight: z.number().optional(),
    files: z.array(readingFileSchema),
  })
  .strict()

const readingGroupSchema = z
  .object({
    layer: z.string(),
    files: z.array(readingFileSchema),
  })
  .strict()

export const diffReadingOutputSchema = z
  .object({
    name: z.string(),
    sections: z.array(readingSectionSchema),
    evidence: z.null(),
    groups: z.array(readingGroupSchema),
  })
  .strict()

export type DiffReadingOutput = z.infer<typeof diffReadingOutputSchema>

const repoPathSchema = z.string()
const repoPathObjectSchema = z.object({ repoPath: z.string() }).strict()
const repoPathAndPathSchema = z
  .object({
    repoPath: z.string(),
    path: z.string(),
  })
  .strict()

export const gitQuickCommandInputSchema = z
  .object({
    repoPath: z.string(),
    command: z.enum(['status', 'pull', 'push', 'fetch', 'stash', 'stash-pop']),
    pullMode: z.enum(['merge', 'rebase']).optional(),
  })
  .strict()
export const gitQuickCommandOutputSchema = z.string()

export const gitPushInputSchema = repoPathObjectSchema
export const gitPushOutputSchema = z.string()

export const gitStageAllInputSchema = repoPathObjectSchema
export const gitStageAllOutputSchema = z.void()
export const gitUnstageAllInputSchema = repoPathObjectSchema
export const gitUnstageAllOutputSchema = z.void()
export const gitStageFileInputSchema = repoPathAndPathSchema
export const gitStageFileOutputSchema = z.void()
export const gitUnstageFileInputSchema = repoPathAndPathSchema
export const gitUnstageFileOutputSchema = z.void()
export const gitDiscardFileInputSchema = repoPathAndPathSchema
export const gitDiscardFileOutputSchema = z.void()

export const gitCommitInputSchema = z
  .object({
    repoPath: z.string(),
    message: z.string().trim().min(1),
  })
  .strict()
export const gitCommitOutputSchema = z.void()

const strictCommitMessageGenerationInputSchema = commitMessageGenerationInputSchema.strict()
export const gitGenerateCommitMessageInputSchema = strictCommitMessageGenerationInputSchema
export const gitGenerateCommitMessageOutputSchema = commitMessageGenerationOutputSchema.strict()
export const gitGenerateCommitGroupsInputSchema = strictCommitMessageGenerationInputSchema
export const gitGenerateCommitGroupsOutputSchema = commitGroupGenerationOutputSchema
  .extend({ groups: z.array(commitGroupGenerationGroupSchema.strict()) })
  .strict()

export const gitCheckoutInputSchema = z
  .object({
    repoPath: z.string(),
    branch: z.string(),
  })
  .strict()
export const gitCheckoutOutputSchema = z.void()

export const gitCreateBranchInputSchema = z
  .object({
    repoPath: z.string(),
    branch: z.string().min(1),
  })
  .strict()
export const gitCreateBranchOutputSchema = z.void()

export const gitAddWorktreeInputSchema = gitCreateBranchInputSchema
export const gitAddWorktreeOutputSchema = worktreeSchema

export const gitCommitConventionsInputSchema = repoPathSchema
export const gitCommitConventionsOutputSchema = commitConventionsSchema
export const gitStatusInputSchema = repoPathSchema
export const gitStatusOutputSchema = z.array(changedFileSchema)
export const gitSuggestionsInputSchema = repoPathSchema
export const gitSuggestionsOutputSchema = z.array(gitSuggestionSchema)
export const gitFlowInputSchema = repoPathSchema
const flowGroupsSchema = z.array(flowGroupSchema)
export const gitFlowOutputSchema = flowGroupsSchema
export const gitRangeFlowInputSchema = repoPathSchema
export const gitRangeFlowOutputSchema = z
  .object({
    groups: flowGroupsSchema,
    base: z.string(),
  })
  .strict()
export const gitRangeDiffFileInputSchema = z
  .object({
    repoPath: z.string(),
    base: z.string(),
    filePath: z.string(),
  })
  .strict()
export const gitRangeDiffFileOutputSchema = diffFileResultSchema
export const gitDiffFileInputSchema = z
  .object({
    repoPath: z.string(),
    filePath: z.string(),
  })
  .strict()
export const gitDiffFileOutputSchema = diffFileResultSchema
export const gitHeadInputSchema = repoPathSchema
export const gitHeadOutputSchema = headRefSchema
export const gitBranchesInputSchema = repoPathSchema
export const gitBranchesOutputSchema = z.array(branchRefSchema)
export const gitWorktreesInputSchema = repoPathSchema
export const gitWorktreesOutputSchema = z.array(worktreeSchema)
export const gitLogInputSchema = z
  .object({
    repoPath: z.string(),
    limit: z.number().int().max(500).default(200),
  })
  .strict()
export const gitLogOutputSchema = z.array(commitSchema)
export const gitCommitMessageInputSchema = z
  .object({
    repoPath: z.string(),
    hash: z.string(),
  })
  .strict()
export const gitCommitMessageOutputSchema = z.string()
export const gitFileLogInputSchema = z
  .object({
    repoPath: z.string(),
    filePath: z.string(),
    limit: z.number().int().max(200).default(50),
  })
  .strict()
export const gitFileLogOutputSchema = z.array(commitSchema)
export const gitCommitDiffInputSchema = z
  .object({
    repoPath: z.string(),
    hash: z.string(),
    filePath: z.string(),
  })
  .strict()
export const gitCommitDiffOutputSchema = z.array(diffHunkSchema)
export const gitCommitFlowInputSchema = gitCommitMessageInputSchema
export const gitCommitFlowOutputSchema = flowGroupsSchema

export const diffReadingInputSchema = z
  .object({
    repoPath: z.string(),
    scope: z.discriminatedUnion('type', [
      z.object({ type: z.literal('working') }).strict(),
      z.object({ type: z.literal('branch') }).strict(),
      z.object({ type: z.literal('commit'), hash: z.string() }).strict(),
    ]),
  })
  .strict()

export const commitModelsInputSchema = z.void()
export const commitModelsOutputSchema = z.array(commitModelOptionSchema.strict())

export type GitQuickCommandInput = z.infer<typeof gitQuickCommandInputSchema>
export type GitQuickCommandOutput = z.infer<typeof gitQuickCommandOutputSchema>
export type GitPushInput = z.infer<typeof gitPushInputSchema>
export type GitPushOutput = z.infer<typeof gitPushOutputSchema>
export type GitStageAllInput = z.infer<typeof gitStageAllInputSchema>
export type GitStageAllOutput = z.infer<typeof gitStageAllOutputSchema>
export type GitUnstageAllInput = z.infer<typeof gitUnstageAllInputSchema>
export type GitUnstageAllOutput = z.infer<typeof gitUnstageAllOutputSchema>
export type GitStageFileInput = z.infer<typeof gitStageFileInputSchema>
export type GitStageFileOutput = z.infer<typeof gitStageFileOutputSchema>
export type GitUnstageFileInput = z.infer<typeof gitUnstageFileInputSchema>
export type GitUnstageFileOutput = z.infer<typeof gitUnstageFileOutputSchema>
export type GitDiscardFileInput = z.infer<typeof gitDiscardFileInputSchema>
export type GitDiscardFileOutput = z.infer<typeof gitDiscardFileOutputSchema>
export type GitCommitInput = z.infer<typeof gitCommitInputSchema>
export type GitCommitOutput = z.infer<typeof gitCommitOutputSchema>
export type GitGenerateCommitMessageInput = z.infer<typeof gitGenerateCommitMessageInputSchema>
export type GitGenerateCommitMessageOutput = z.infer<typeof gitGenerateCommitMessageOutputSchema>
export type GitGenerateCommitGroupsInput = z.infer<typeof gitGenerateCommitGroupsInputSchema>
export type GitGenerateCommitGroupsOutput = z.infer<typeof gitGenerateCommitGroupsOutputSchema>
export type GitCheckoutInput = z.infer<typeof gitCheckoutInputSchema>
export type GitCheckoutOutput = z.infer<typeof gitCheckoutOutputSchema>
export type GitCreateBranchInput = z.infer<typeof gitCreateBranchInputSchema>
export type GitCreateBranchOutput = z.infer<typeof gitCreateBranchOutputSchema>
export type GitAddWorktreeInput = z.infer<typeof gitAddWorktreeInputSchema>
export type GitAddWorktreeOutput = z.infer<typeof gitAddWorktreeOutputSchema>
export type GitCommitConventionsInput = z.infer<typeof gitCommitConventionsInputSchema>
export type GitCommitConventionsOutput = z.infer<typeof gitCommitConventionsOutputSchema>
export type GitStatusInput = z.infer<typeof gitStatusInputSchema>
export type GitStatusOutput = z.infer<typeof gitStatusOutputSchema>
export type GitSuggestionsInput = z.infer<typeof gitSuggestionsInputSchema>
export type GitSuggestionsOutput = z.infer<typeof gitSuggestionsOutputSchema>
export type GitFlowInput = z.infer<typeof gitFlowInputSchema>
export type GitFlowOutput = z.infer<typeof gitFlowOutputSchema>
export type GitRangeFlowInput = z.infer<typeof gitRangeFlowInputSchema>
export type GitRangeFlowOutput = z.infer<typeof gitRangeFlowOutputSchema>
export type GitRangeDiffFileInput = z.infer<typeof gitRangeDiffFileInputSchema>
export type GitRangeDiffFileOutput = z.infer<typeof gitRangeDiffFileOutputSchema>
export type GitDiffFileInput = z.infer<typeof gitDiffFileInputSchema>
export type GitDiffFileOutput = z.infer<typeof gitDiffFileOutputSchema>
export type GitHeadInput = z.infer<typeof gitHeadInputSchema>
export type GitHeadOutput = z.infer<typeof gitHeadOutputSchema>
export type GitBranchesInput = z.infer<typeof gitBranchesInputSchema>
export type GitBranchesOutput = z.infer<typeof gitBranchesOutputSchema>
export type GitWorktreesInput = z.infer<typeof gitWorktreesInputSchema>
export type GitWorktreesOutput = z.infer<typeof gitWorktreesOutputSchema>
export type GitLogInput = z.infer<typeof gitLogInputSchema>
export type GitLogOutput = z.infer<typeof gitLogOutputSchema>
export type GitCommitMessageInput = z.infer<typeof gitCommitMessageInputSchema>
export type GitCommitMessageOutput = z.infer<typeof gitCommitMessageOutputSchema>
export type GitFileLogInput = z.infer<typeof gitFileLogInputSchema>
export type GitFileLogOutput = z.infer<typeof gitFileLogOutputSchema>
export type GitCommitDiffInput = z.infer<typeof gitCommitDiffInputSchema>
export type GitCommitDiffOutput = z.infer<typeof gitCommitDiffOutputSchema>
export type GitCommitFlowInput = z.infer<typeof gitCommitFlowInputSchema>
export type GitCommitFlowOutput = z.infer<typeof gitCommitFlowOutputSchema>
export type DiffReadingInput = z.infer<typeof diffReadingInputSchema>
export type CommitModelsInput = z.infer<typeof commitModelsInputSchema>
export type CommitModelsOutput = z.infer<typeof commitModelsOutputSchema>

export { gitContractFixtures } from './git.fixtures'
