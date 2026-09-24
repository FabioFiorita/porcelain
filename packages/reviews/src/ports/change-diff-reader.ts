import type { ExpectedFile } from '@porcelain/kernel/models';
import type {
  ChangeDiffs,
  ChangeSelection,
} from '../models/review-evidence.ts';

export interface ChangeDiffReader {
  read(
    worktreeId: string,
    statusToken: string,
    expectedFiles: readonly ExpectedFile[],
    selections: readonly ChangeSelection[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffs>;
}
