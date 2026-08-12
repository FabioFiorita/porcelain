import { applyCommitPrefix } from '@porcelain/client-runtime/commit-message'

import type { FlowGroup } from '@porcelain/contracts/git'

/** What the working tree looks like to the commit card's buttons. */
export type StagingState = {
  /** Every file is staged and none of it also has unstaged edits — so the toggle says Unstage. */
  allStaged: boolean
  hasStaged: boolean
  hasUnstaged: boolean
  /** Nothing to stage or commit. A push is still legitimate here — the commits already exist. */
  treeClean: boolean
}

/**
 * Read the staging state out of the flow-grouped working tree.
 *
 * `allStaged` deliberately excludes a file that is staged AND has further unstaged edits: the
 * toggle would offer to unstage while half the change is still not staged, which is the opposite
 * of what the reader is looking at.
 */
export function stagingState(groups: readonly FlowGroup[] | undefined): StagingState {
  const files = (groups ?? []).flatMap((group) => group.files)
  return {
    allStaged:
      files.length > 0 && files.every((file) => file.staged === true && file.unstaged !== true),
    hasStaged: files.some((file) => file.staged === true),
    hasUnstaged: files.some((file) => file.unstaged === true),
    treeClean: files.length === 0,
  }
}

/**
 * Whether Commit can run: a message with something in it beyond its conventional prefix, and a
 * tree with something in it.
 *
 * The prefix is stripped before the emptiness check because `feat(mobile):` on its own is a
 * chosen type and scope, not a commit message — the button stays disabled until the summary is
 * written.
 */
export function commitReady(message: string, treeClean: boolean): boolean {
  return applyCommitPrefix(message, null, null).trim() !== '' && !treeClean
}
