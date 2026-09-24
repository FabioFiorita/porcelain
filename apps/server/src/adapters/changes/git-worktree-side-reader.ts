import { join } from 'node:path';
import type { WorktreeEntry } from '@porcelain/changes/models';
import type { WorktreeSideReader } from '@porcelain/changes/ports';
import type { InspectionCheckouts } from './inspection-checkouts.ts';
import { readWorktreeFiles, stampPath } from './worktree-files.ts';

export class GitWorktreeSideReader implements WorktreeSideReader {
  private readonly checkouts: InspectionCheckouts;

  constructor(checkouts: InspectionCheckouts) {
    this.checkouts = checkouts;
  }

  async readEntries(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, WorktreeEntry>> {
    const { worktree } = await this.checkouts.open(worktreeId, signal);
    return readWorktreeFiles(worktree.path, paths);
  }

  async readSubmoduleHeads(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>> {
    const { git } = await this.checkouts.open(worktreeId, signal);
    return git.readSubmoduleHeads(paths, signal);
  }

  async readStagingStamp(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const { worktree } = await this.checkouts.open(worktreeId, signal);
    return (
      (await stampPath(join(worktree.administrativeDirectory, 'index'))) ??
      undefined
    );
  }
}
