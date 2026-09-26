import type {
  StagingStampRequest,
  SubmoduleHeadsRequest,
  WorktreeEntriesRequest,
  WorktreeEntry,
} from '../models/worktree-side.ts';

export interface WorktreeSideReader {
  readEntries(
    input: WorktreeEntriesRequest,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, WorktreeEntry>>;
  readSubmoduleHeads(
    input: SubmoduleHeadsRequest,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>>;
  readStagingStamp(
    input: StagingStampRequest,
    signal?: AbortSignal,
  ): Promise<string | undefined>;
}
