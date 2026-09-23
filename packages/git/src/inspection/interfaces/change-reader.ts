import type { GitBranchDetails } from '../dtos/git-status.ts';
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
  ): Promise<GitBranchDetails>;
  readLines(
    range: Omit<LineRange, 'at'>,
    signal?: AbortSignal,
  ): Promise<string[]>;
}
