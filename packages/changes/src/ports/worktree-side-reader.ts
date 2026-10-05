import { type GitIoFailure } from '@porcelain/git/errors';
import { type Effect, Context } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type StagingStampRequest,
  type SubmoduleHeadsRequest,
  type WorktreeEntriesRequest,
  type WorktreeEntry,
} from '../models/worktree-side.ts';

export interface WorktreeSideReader {
  readEntries(
    input: WorktreeEntriesRequest,
  ): Effect.Effect<
    ReadonlyMap<string, WorktreeEntry>,
    GitIoFailure,
    WorktreeRead
  >;
  readSubmoduleHeads(
    input: SubmoduleHeadsRequest,
  ): Effect.Effect<ReadonlyMap<string, string>, GitIoFailure, WorktreeRead>;
  readStagingStamp(
    input: StagingStampRequest,
  ): Effect.Effect<string | undefined, GitIoFailure, WorktreeRead>;
}

export const WorktreeSideReader = Context.Service<
  '@porcelain/changes/WorktreeSideReader',
  WorktreeSideReader
>('@porcelain/changes/WorktreeSideReader');
