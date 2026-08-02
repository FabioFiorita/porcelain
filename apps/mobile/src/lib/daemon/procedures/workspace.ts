import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

const branchRefSchema = z.object({ name: z.string(), remote: z.string().nullable() })
const worktreeSchema = z.object({ path: z.string(), branch: z.string() })

export type BranchRef = z.infer<typeof branchRefSchema>
export type Worktree = z.infer<typeof worktreeSchema>

/** Branches and linked worktrees are the three-part workspace context in the native header. */
export const gitBranchesQuery = defineQuery<string, BranchRef[]>(
  'gitBranches',
  z.array(branchRefSchema),
)

export const gitWorktreesQuery = defineQuery<string, Worktree[]>(
  'gitWorktrees',
  z.array(worktreeSchema),
)

/** Checkout changes this worktree in place; git refuses when the dirty tree would be clobbered. */
export const gitCheckoutMutation = defineMutation<{ repoPath: string; branch: string }, void>(
  'gitCheckout',
  z.void(),
)

/** Checkout moves the subject of every mounted Changes/Review query, not just the header label. */
export const WORKSPACE_CHECKOUT_INVALIDATIONS = [
  'diffReading',
  'featureReading',
  'featureView',
  'gitBranches',
  'gitCommitConventions',
  'gitDiffFile',
  'gitFlow',
  'gitHead',
  'gitLog',
  'gitRangeFlow',
  'gitSuggestions',
  'gitStatus',
  'gitWorktrees',
  'reviewedPaths',
  'worktreeInbox',
] as const
