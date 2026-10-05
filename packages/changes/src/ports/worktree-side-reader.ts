import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  StagingStampRequest,
  SubmoduleHeadsRequest,
  WorktreeEntriesRequest,
  WorktreeEntry,
} from '../models/worktree-side.ts';

export interface WorktreeSideReader<E = never> {
  readEntries(
    input: WorktreeEntriesRequest,
  ): Effect.Effect<ReadonlyMap<string, WorktreeEntry>, E, WorktreeRead>;
  readSubmoduleHeads(
    input: SubmoduleHeadsRequest,
  ): Effect.Effect<ReadonlyMap<string, string>, E, WorktreeRead>;
  readStagingStamp(
    input: StagingStampRequest,
  ): Effect.Effect<string | undefined, E, WorktreeRead>;
}
