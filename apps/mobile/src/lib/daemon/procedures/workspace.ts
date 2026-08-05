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

/**
 * `git checkout -b` off the current HEAD: the branch is created *and* checked out here, so this
 * moves the workspace exactly like a checkout does. git is the validator — a malformed ref name
 * or an existing branch comes back as git's own message for the sheet to show.
 */
export const gitCreateBranchMutation = defineMutation<{ repoPath: string; branch: string }, void>(
  'gitCreateBranch',
  z.void(),
)

/**
 * `git worktree add -b`: a new branch off the current HEAD, checked out in a *linked* worktree.
 * There is no path input — the daemon derives `<repo>-worktrees/<branch>` beside the repo and
 * echoes the realpath'd result back, which is the only way the client learns where it landed.
 */
export const gitAddWorktreeMutation = defineMutation<
  { repoPath: string; branch: string },
  Worktree
>('gitAddWorktree', worktreeSchema)

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

/**
 * Adding a worktree leaves *this* checkout untouched — HEAD, the diff, and the working tree are
 * all still the same. Only the branch roster, the worktree roster, and the Review inbox move, so
 * this is deliberately narrower than `WORKSPACE_CHECKOUT_INVALIDATIONS`.
 */
export const WORKSPACE_ADD_WORKTREE_INVALIDATIONS = [
  'gitBranches',
  'gitWorktrees',
  'worktreeInbox',
] as const
