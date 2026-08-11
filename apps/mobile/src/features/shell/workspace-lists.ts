import { fileName } from '@porcelain/client-runtime/paths'

import type { BranchRef, Worktree } from '@porcelain/contracts/git'

/**
 * The workspace pickers' derivations, with no React and no daemon in them.
 *
 * The three sheets and the header all answer the same questions — which branches match what was
 * typed, which worktree already holds a branch, what the three chips should say — and each one
 * used to answer them inline. Pure functions here mean the answers are asserted once in
 * `workspace-lists.test.ts` instead of only ever being seen on a device.
 */

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}

/** Test IDs are deterministic path identities, never array positions. */
export function workspaceTestId(prefix: string, value: string): string {
  const slug = value
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `porcelain-${prefix}-${slug || 'item'}`
}

/** How a branch reads in a row: bare locally, `remote/name` when it lives on a remote. */
export function branchLabel(branch: BranchRef): string {
  return branch.remote === null ? branch.name : `${branch.remote}/${branch.name}`
}

/**
 * Local and remote matches for the search field, in one pass so both lists share the same
 * normalization. Remote branches match on their qualified label — typing `origin/` is how you
 * narrow to a remote.
 */
export function matchBranches(
  branches: readonly BranchRef[],
  query: string,
): { local: BranchRef[]; remote: BranchRef[] } {
  const needle = query.trim().toLowerCase()
  return {
    local: branches.filter(
      (branch) => branch.remote === null && branch.name.toLowerCase().includes(needle),
    ),
    remote: branches.filter(
      (branch) => branch.remote !== null && branchLabel(branch).toLowerCase().includes(needle),
    ),
  }
}

/** Every local branch name — unfiltered, because the create form validates against all of them. */
export function localBranchNames(branches: readonly BranchRef[]): string[] {
  return branches.filter((branch) => branch.remote === null).map((branch) => branch.name)
}

/**
 * The worktree holding `branchName`, if it is not the one we are standing in.
 *
 * git refuses to check a branch out twice, so this is what turns a branch row from "switch" into
 * "go to the worktree that has it".
 */
export function blockingWorktree(
  worktrees: readonly Worktree[],
  branchName: string,
  repoPath: string,
): Worktree | undefined {
  return worktrees.find((worktree) => worktree.path !== repoPath && worktree.branch === branchName)
}

export type BranchRowFacts = {
  label: string
  detail: string | undefined
  selected: boolean
  blocked: boolean
  accessibilityLabel: string
}

/** Everything a branch row renders, derived once so the row itself stays markup. */
export function branchRowFacts(
  branch: BranchRef,
  currentBranch: string | null,
  worktrees: readonly Worktree[],
  repoPath: string,
): BranchRowFacts {
  const blockedBy = blockingWorktree(worktrees, branch.name, repoPath)
  const selected = branch.remote === null && branch.name === currentBranch
  const label = branchLabel(branch)

  return {
    accessibilityLabel:
      blockedBy === undefined ? label : `${label}, checked out in another worktree`,
    blocked: blockedBy !== undefined,
    detail:
      blockedBy !== undefined
        ? `Checked out in ${blockedBy.path} · switch worktree`
        : selected
          ? 'Current branch'
          : branch.remote === null
            ? undefined
            : 'Remote branch',
    label,
    selected,
  }
}

export type WorkspaceIdentityInput = {
  /** `null` means no project is open — every chip says so rather than guessing. */
  repoName: string | null
  repoPath: string
  /** `git worktree list` puts the main worktree first; `null` while the roster is unread. */
  mainWorktreePath: string | null
  /** Resolved HEAD label, or `null` while it is unknown. */
  branch: string | null
  /** True once the HEAD read has failed — the difference between "…" and "No branch". */
  branchFailed: boolean
  environmentNickname: string | null
}

export type WorkspaceIdentity = {
  branch: string
  projectName: string
  worktree: string
  projectInitial: string
  environmentLabel: string
}

/**
 * The live three-part workspace identity used by both phone and tablet chrome.
 *
 * Three chips have to carry three different facts or they are noise. Two of them used to
 * collide: the worktree chip read back the branch checked out in it, and a worktree is named
 * for its branch — so the header said the same word twice and the reader had to work out which
 * chip was which. `repo.name` is only the active path's basename, so naming the worktree by its
 * folder instead just moves the collision onto the project chip, which in a linked checkout was
 * already reporting the worktree's folder as the project.
 *
 * So both come off the worktree roster: git lists the main worktree first, its folder is the
 * project, and the chip says where you are actually standing.
 */
export function deriveWorkspaceIdentity(input: WorkspaceIdentityInput): WorkspaceIdentity {
  const { branch, branchFailed, environmentNickname, mainWorktreePath, repoName, repoPath } = input
  const open = repoName !== null
  // The linked worktrees live in a sibling `<repo>-worktrees/` directory and must not rename
  // the project.
  const projectName =
    mainWorktreePath === null ? (repoName ?? 'Project') : fileName(mainWorktreePath)

  return {
    branch: !open ? 'No project' : (branch ?? (branchFailed ? 'No branch' : '…')),
    environmentLabel: environmentNickname ?? 'No environment',
    projectInitial: projectName.charAt(0).toUpperCase() || '?',
    projectName,
    // Until the roster lands, the folder is the honest answer: less specific than "Main", never
    // wrong. Naming it before we know which checkout is the main one would be a guess.
    worktree: !open
      ? 'No project'
      : mainWorktreePath === repoPath
        ? 'Main'
        : fileName(repoPath) || repoName,
  }
}
