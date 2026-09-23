import type { WorktreeEntry } from '../models/change.ts';

export type { WorktreeEntry } from '../models/change.ts';

export interface WorktreeSideReader {
  readFiles(
    root: string,
    paths: readonly string[],
  ): Promise<Map<string, WorktreeEntry>>;
  readSubmoduleHeads(
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<Map<string, string>>;
}
