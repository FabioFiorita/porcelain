import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../inspection/status.ts';

export interface DiffReader {
  readDiff(
    change: GitOrdinaryChange,
    signal?: AbortSignal,
  ): Promise<GitDiffResult>;
  readDiffs(
    changes: readonly GitOrdinaryChange[],
    signal?: AbortSignal,
  ): Promise<GitDiffResult[]>;
}
