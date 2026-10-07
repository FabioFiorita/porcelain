import { Effect, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { readGitEffect } from '../../runtime/git-io.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { join } from 'node:path';
import { readSubmoduleHeads } from '@porcelain/git/inspection';
import { captureGitPlatform } from '@porcelain/git/discovery';
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
  Layer.effect(
    WorktreeSideReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        readEntries: Effect.fn('GitWorktreeSideReader.readEntries')(function* (
          input: WorktreeEntriesRequest,
        ): Effect.fn.Return<
          ReadonlyMap<string, WorktreeEntry>,
          GitIoFailure,
          WorktreeRead
        > {
          const { worktree } = yield* readGitEffect(
            input.worktreeId,
            open(input.worktreeId).pipe(provideGit),
          );
          return yield* readWorktreeFiles(
            worktree.path,
            input.paths,
            input.maxDigestBytes,
            options,
          );
        }),
        readSubmoduleHeads: Effect.fn(
          'GitWorktreeSideReader.readSubmoduleHeads',
        )(function* (input: SubmoduleHeadsRequest) {
          return yield* readGitEffect(
            input.worktreeId,
            Effect.gen(function* () {
              const { checkout, limits } = yield* open(input.worktreeId);
              yield* checkout.verify();
              return yield* readSubmoduleHeads(checkout, input.paths, limits);
            }).pipe(provideGit),
          );
        }),
        readStagingStamp: Effect.fn('GitWorktreeSideReader.readStagingStamp')(
          function* (input: StagingStampRequest) {
            const { worktree } = yield* readGitEffect(
              input.worktreeId,
              open(input.worktreeId).pipe(provideGit),
            );
            return yield* stampPath(
              join(worktree.administrativeDirectory, 'index'),
            );
          },
        ),
      };
    }),
  );
