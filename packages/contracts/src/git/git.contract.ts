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

/**
 * A proposed group as the daemon will apply it: stage exactly these whole files, then commit
 * them with this message. Partial-file hunks are deliberately out of scope.
 */
export const commitGroupPlanSchema = z
  .object({
    files: z.array(z.string().trim().min(1)).min(1),
    message: z.string().trim().min(1),
  })
  .strict()

/**
 * One group's outcome, in the order it was submitted. `skipped` means an earlier group failed
 * and the batch stopped before reaching this one — those files are still in the working tree.
 */
export const commitGroupResultSchema = z
  .object({
    files: z.array(z.string()),
    message: z.string(),
    status: z.enum(['committed', 'failed', 'skipped']),
    error: z.string().nullable(),
  })
  .strict()

export const gitApplyCommitGroupsInputSchema = z
  .object({
    repoPath: z.string(),
    groups: z.array(commitGroupPlanSchema).min(1),
  })
  .strict()
export const gitApplyCommitGroupsOutputSchema = z
  .object({ results: z.array(commitGroupResultSchema) })
  .strict()

/**
 * A branch name as a client supplies it — the same shape a compare base must have,
 * because both land in git's argv where a leading "-" would be read as an option
 * (`checkout -b --orphan`). Slash-separated names (`feature/x`) stay legal; git
 * forbids whitespace in refs anyway, so `isSingleRefToken` rejects nothing valid.
 * (Its forward reference to `isSingleRefToken` runs at parse time, not load time.)
 */
export const branchNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((branch) => !branch.startsWith('-'), { message: 'branch may not start with "-"' })
  .refine(isSingleRefToken, {
    message: 'branch may not contain whitespace or control characters',
  })
export type BranchName = z.infer<typeof branchNameSchema>

export const gitCheckoutInputSchema = z
  .object({
    repoPath: z.string(),
    branch: branchNameSchema,
  })
  .strict()
export const gitCheckoutOutputSchema = z.void()

export const gitCreateBranchInputSchema = z
  .object({
    repoPath: z.string(),
    branch: branchNameSchema,
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
/**
 * The ref a Branch review is measured against, as the client asks for it.
 *
 * Wire-level sanity only — a bounded, single-token, non-option string. The daemon
 * is what decides whether it NAMES anything (`gitResolveCompareBase`): only an
 * existing local branch, a remote-tracking branch, or the literal upstream is
 * accepted, and a value that no longer resolves falls back to the default base.
 * `@{u}` is the "just the remote" choice — this branch's own upstream, whatever
 * it is called.
 */
/**
 * A ref name is one printable, space-free token.
 *
 * Written as a code-point scan rather than a regex so it rejects control
 * characters without embedding any, and so a non-ASCII branch name still passes —
 * git allows those and a reviewer with one should still be able to compare
 * against it.
 */
export function isSingleRefToken(ref: string): boolean {
  for (const char of ref) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x20 || code === 0x7f) return false
  }
  return true
}

export const compareBaseSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((ref) => !ref.startsWith('-'), { message: 'base ref may not start with "-"' })
  .refine(isSingleRefToken, {
    message: 'base ref may not contain whitespace or control characters',
  })
export type CompareBase = z.infer<typeof compareBaseSchema>

/** The literal that means "compare against this branch's own upstream". */
export const UPSTREAM_COMPARE_BASE = '@{u}'

export const gitRangeFlowInputSchema = z
  .object({
    repoPath: z.string(),
    /** Absent = the default base (origin/HEAD, else local main/master). */
    base: compareBaseSchema.optional(),
  })
  .strict()
export const gitRangeFlowOutputSchema = z
  .object({
    groups: flowGroupsSchema,
    /** The ref actually used — what the "vs …" label reads and what per-file range reads pass back. */
    base: z.string(),
    /** The base used when nothing is chosen, so the picker can mark it as the default. */
    defaultBase: z.string(),
  })
  .strict()
/**
 * Lines of unchanged context git keeps around each change (`git diff -U<n>`).
 * Omitted means git's own default of 3. A client that offers "expand context"
 * asks for a large value once and collapses the surplus itself, so expanding a
 * gap costs no round trip.
 */
export const diffContextSchema = z.number().int().min(0).max(100_000)
export const gitRangeDiffFileInputSchema = z
  .object({
    repoPath: z.string(),
    base: z.string(),
    filePath: z.string(),
    context: diffContextSchema.optional(),
  })
  .strict()
export const gitRangeDiffFileOutputSchema = diffFileResultSchema
export const gitDiffFileInputSchema = z
  .object({
    repoPath: z.string(),
    filePath: z.string(),
    context: diffContextSchema.optional(),
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
      z.object({ type: z.literal('branch'), base: compareBaseSchema.optional() }).strict(),
      z.object({ type: z.literal('commit'), hash: z.string() }).strict(),
    ]),
    context: diffContextSchema.optional(),
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
export type CommitGroupPlan = z.infer<typeof commitGroupPlanSchema>
export type CommitGroupResult = z.infer<typeof commitGroupResultSchema>
export type GitApplyCommitGroupsInput = z.infer<typeof gitApplyCommitGroupsInputSchema>
export type GitApplyCommitGroupsOutput = z.infer<typeof gitApplyCommitGroupsOutputSchema>
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
