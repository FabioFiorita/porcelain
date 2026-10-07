import { readGitEffect } from '../../runtime/git-io.ts';
import { nativeOperation } from '@porcelain/effects';
import type {
  WorktreePathsRead,
  WorktreePathsReadInput,
} from '@porcelain/files/models';
import { WorktreePathsReader } from '@porcelain/files/ports';
import { Effect, Layer } from 'effect';
import { InspectionLimitError } from '@porcelain/git/errors';
import { listTrackedPaths } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export const gitWorktreePathsReaderLayer = (
  worktrees: ListedWorktrees,
  limits: Limits['git'],
) =>
  Layer.succeed(WorktreePathsReader, {
    read: Effect.fn('GitWorktreePathsReader.read')(
      (input: WorktreePathsReadInput) =>
        readGitEffect(
          input.worktreeId,
          Effect.gen(function* () {
            const checkout = yield* nativeOperation((signal) =>
              listedWorktree(worktrees, input.worktreeId, signal),
            );
            return yield* nativeOperation((signal) =>
              listTrackedPaths(checkout.path, limits, signal),
            ).pipe(
              Effect.map((listed): WorktreePathsRead =>
                listed.complete
                  ? { kind: 'listed', paths: listed.paths }
                  : { kind: 'too-large' },
              ),
              Effect.catchDefect((error) =>
                error instanceof InspectionLimitError
                  ? Effect.succeed<WorktreePathsRead>({ kind: 'too-large' })
                  : Effect.die(error),
              ),
            );
          }),
        ).pipe(Effect.orDie),
    ),
  });
