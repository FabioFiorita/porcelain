import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { Effect } from 'effect';
import type { IgnoredEntriesReadInput } from '../models/ignored-entries-read.ts';

export interface IgnoredEntriesReader {
  read(
    input: IgnoredEntriesReadInput,
  ): Effect.Effect<ReadonlySet<string>, never, WorktreeRead>;
}
