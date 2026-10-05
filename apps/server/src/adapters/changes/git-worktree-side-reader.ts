import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { readGit } from '../../runtime/git-io.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import { join } from 'node:path';
import type {
  StagingStampRequest,
  SubmoduleHeadsRequest,
  WorktreeEntriesRequest,
  WorktreeEntry,
} from '@porcelain/changes/models';
import type { WorktreeSideReader } from '@porcelain/changes/ports';
import type { OpenInspection } from './inspection-checkouts.ts';
import {
  readWorktreeFiles,
  stampPath,
  type WorktreeReadOptions,
} from './worktree-files.ts';

export class GitWorktreeSideReader implements WorktreeSideReader<GitIoFailure> {
  private readonly open: OpenInspection;
  private readonly options: WorktreeReadOptions;

  constructor(open: OpenInspection, options: WorktreeReadOptions) {
    this.open = open;
    this.options = options;
  }

  readEntries(
    input: WorktreeEntriesRequest,
  ): Effect.Effect<
    ReadonlyMap<string, WorktreeEntry>,
    GitIoFailure,
    WorktreeRead
  > {
    return readGit(input.worktreeId, (signal) =>
      this.readEntriesNative(input, signal),
    );
  }

  private async readEntriesNative(
    input: WorktreeEntriesRequest,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, WorktreeEntry>> {
    const { worktree } = await this.open(input.worktreeId, signal);
    return readWorktreeFiles(
      worktree.path,
      input.paths,
      input.maxDigestBytes,
      this.options,
    );
  }

  readSubmoduleHeads(
    input: SubmoduleHeadsRequest,
  ): Effect.Effect<ReadonlyMap<string, string>, GitIoFailure, WorktreeRead> {
    return readGit(input.worktreeId, (signal) =>
      this.readSubmoduleHeadsNative(input, signal),
    );
  }

  private async readSubmoduleHeadsNative(
    input: SubmoduleHeadsRequest,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>> {
    const { git } = await this.open(input.worktreeId, signal);
    return git.readSubmoduleHeads(input.paths, signal);
  }

  readStagingStamp(
    input: StagingStampRequest,
  ): Effect.Effect<string | undefined, GitIoFailure, WorktreeRead> {
    return readGit(input.worktreeId, (signal) =>
      this.readStagingStampNative(input, signal),
    );
  }

  private async readStagingStampNative(
    input: StagingStampRequest,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const { worktree } = await this.open(input.worktreeId, signal);
    return stampPath(join(worktree.administrativeDirectory, 'index'));
  }
}
