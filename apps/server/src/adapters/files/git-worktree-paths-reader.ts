import { InspectionLimitError } from '@porcelain/git/errors';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { readGitEffect } from '../../runtime/git-io.ts';
import type {
  WorktreePathsRead,
  WorktreePathsReadInput,
} from '@porcelain/files/models';
import { WorktreePathsReader } from '@porcelain/files/ports';
import { Effect, Layer } from 'effect';
import { listTrackedPaths } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  listedWorktreeEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export const gitWorktreePathsReaderLayer = (
  worktrees: ListedWorktrees,
  limits: Limits['git'],
) =>
  Layer.effect(
    WorktreePathsReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        read: Effect.fn('GitWorktreePathsReader.read')(
          (input: WorktreePathsReadInput) =>
            readGitEffect(
              input.worktreeId,
              Effect.gen(function* () {
                const checkout = yield* listedWorktreeEffect(
                  worktrees,
                  input.worktreeId,
                );
                return yield* listTrackedPaths(checkout.path, limits).pipe(
                  Effect.map((listed): WorktreePathsRead =>
                    listed.complete
                      ? { kind: 'listed', paths: listed.paths }
                      : { kind: 'too-large' },
                  ),
                  Effect.catchIf(
                    (error): error is InspectionLimitError =>
                      error instanceof InspectionLimitError,
                    () =>
                      Effect.succeed<WorktreePathsRead>({ kind: 'too-large' }),
                  ),
                );
              }).pipe(provideGit),
            ).pipe(Effect.orDie),
        ),
      };
    }),
  );
