import { admittedRead, nativeOperation } from '@porcelain/effects';
import type { IgnoredEntriesReadInput } from '@porcelain/files/models';
import { IgnoredEntriesReader } from '@porcelain/files/ports';
import { Effect, Layer } from 'effect';
import { checkIgnored } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export const gitIgnoredEntriesReaderLayer = (
  worktrees: ListedWorktrees,
  limits: Limits['git'],
) =>
  Layer.succeed(IgnoredEntriesReader, {
    read: Effect.fn('GitIgnoredEntriesReader.read')(
      (input: IgnoredEntriesReadInput) =>
        admittedRead(
          input.worktreeId,
          Effect.gen(function* () {
            const checkout = yield* nativeOperation((signal) =>
              listedWorktree(worktrees, input.worktreeId, signal),
            );
            return yield* nativeOperation((signal) =>
              checkIgnored(checkout.path, input.paths, limits, signal),
            );
          }),
        ),
    ),
  });
