import type { GitBranchStatus } from '../dtos/git-status.ts';
import type { LineRange } from '../dtos/line-range.ts';

/**
 * The reads a change list needs beyond the status itself: where a changed
 * submodule currently points, and the branch details that only the action UI
 * uses. They are separate from the status because they are separate costs,
 * and each is paid only when something actually needs it.
 *
 * Digesting working files is not here on purpose: that is a filesystem read,
 * and doing it through Git made a filename containing a newline break the
 * whole list.
 */
export interface ChangeReader {
  readSubmoduleHeads(
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<Map<string, string>>;
  readBranchDetails(
    branch: string | null,
    headOid: string | null,
    signal?: AbortSignal,
  ): Promise<{
    remoteName: string | null;
    sourceRef: string | null;
    upstreamOid: string | null;
    stashes: NonNullable<GitBranchStatus['stashes']>;
    headCommit: { subject: string; body?: string } | null;
  }>;
  /** The lines of a path at the last commit. The working file is not here. */
  readLines(
    range: Omit<LineRange, 'at'>,
    signal?: AbortSignal,
  ): Promise<string[]>;
}
