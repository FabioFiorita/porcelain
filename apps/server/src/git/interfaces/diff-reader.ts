import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../dtos/git-status.ts';

export interface DiffReader {
  readDiff(
    change: GitOrdinaryChange,
    signal?: AbortSignal,
  ): Promise<GitDiffResult>;
}
