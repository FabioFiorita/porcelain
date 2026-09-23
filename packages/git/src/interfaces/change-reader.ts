import type { GitBranchStatus } from '../dtos/git-status.ts';
import type { LineRange } from '../dtos/line-range.ts';

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
    discarded: NonNullable<GitBranchStatus['discarded']>;
    headCommit: { subject: string; body?: string } | null;
  }>;
  readLines(
    range: Omit<LineRange, 'at'>,
    signal?: AbortSignal,
  ): Promise<string[]>;
}
