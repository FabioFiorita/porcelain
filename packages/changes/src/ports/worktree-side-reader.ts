import type { WorktreeEntry } from '../models/worktree-side.ts';

export interface WorktreeSideReader {
  readEntries(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, WorktreeEntry>>;
  readSubmoduleHeads(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>>;
  readStagingStamp(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<string | undefined>;
}
