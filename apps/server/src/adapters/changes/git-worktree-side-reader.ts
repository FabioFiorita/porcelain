import { join } from 'node:path';
import type {
  StagingStampRequest,
  SubmoduleHeadsRequest,
  WorktreeEntriesRequest,
  WorktreeEntry,
} from '@porcelain/changes/models';
import type { WorktreeSideReader } from '@porcelain/changes/ports';
import type { OpenInspection } from './inspection-checkouts.ts';
import { readWorktreeFiles, stampPath } from './worktree-files.ts';

export class GitWorktreeSideReader implements WorktreeSideReader {
  private readonly open: OpenInspection;

  constructor(open: OpenInspection) {
    this.open = open;
  }

  async readEntries(
    input: WorktreeEntriesRequest,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, WorktreeEntry>> {
    const { worktree } = await this.open(input.worktreeId, signal);
    return readWorktreeFiles(worktree.path, input.paths, input.maxDigestBytes);
  }

  async readSubmoduleHeads(
    input: SubmoduleHeadsRequest,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>> {
    const { git } = await this.open(input.worktreeId, signal);
    return git.readSubmoduleHeads(input.paths, signal);
  }

  async readStagingStamp(
    input: StagingStampRequest,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const { worktree } = await this.open(input.worktreeId, signal);
    return stampPath(join(worktree.administrativeDirectory, 'index'));
  }
}
