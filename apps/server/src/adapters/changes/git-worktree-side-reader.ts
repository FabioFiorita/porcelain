import { Effect, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { readGit } from '../../runtime/git-io.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { join } from 'node:path';
import {
  type StagingStampRequest,
  type SubmoduleHeadsRequest,
  type WorktreeEntriesRequest,
  type WorktreeEntry,
} from '@porcelain/changes/models';
import { WorktreeSideReader } from '@porcelain/changes/ports';
import { type OpenInspection } from './inspection-checkouts.ts';
import {
  readWorktreeFiles,
  stampPath,
  type WorktreeReadOptions,
} from './worktree-files.ts';

export const gitWorktreeSideReaderLayer = (
  open: OpenInspection,
  options: WorktreeReadOptions,
) =>
  Layer.succeed(WorktreeSideReader, {
    readEntries: Effect.fn('GitWorktreeSideReader.readEntries')(function* (
      input: WorktreeEntriesRequest,
    ): Effect.fn.Return<
      ReadonlyMap<string, WorktreeEntry>,
      GitIoFailure,
      WorktreeRead
    > {
      const { worktree } = yield* readGit(input.worktreeId, (signal) =>
        open(input.worktreeId, signal),
      );
      return yield* readWorktreeFiles(
        worktree.path,
        input.paths,
        input.maxDigestBytes,
        options,
      );
    }),
    readSubmoduleHeads: Effect.fn('GitWorktreeSideReader.readSubmoduleHeads')(
      function* (input: SubmoduleHeadsRequest) {
        const { git } = yield* readGit(input.worktreeId, (signal) =>
          open(input.worktreeId, signal),
        );
        return yield* readGit(input.worktreeId, (signal) =>
          git.readSubmoduleHeads(input.paths, signal),
        );
      },
    ),
    readStagingStamp: Effect.fn('GitWorktreeSideReader.readStagingStamp')(
      function* (input: StagingStampRequest) {
        const { worktree } = yield* readGit(input.worktreeId, (signal) =>
          open(input.worktreeId, signal),
        );
        return yield* stampPath(
          join(worktree.administrativeDirectory, 'index'),
        );
      },
    ),
  });
