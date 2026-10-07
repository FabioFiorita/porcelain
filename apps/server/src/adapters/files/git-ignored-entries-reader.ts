import { captureGitPlatform } from '../projects/git-platform.ts';
import { readGitEffect } from '../../runtime/git-io.ts';
import type { IgnoredEntriesReadInput } from '@porcelain/files/models';
import { IgnoredEntriesReader } from '@porcelain/files/ports';
import { Effect, Layer } from 'effect';
import { checkIgnored } from '@porcelain/git/inspection';
import type { Limits } from '../../config/limits.ts';
import {
  listedWorktreeEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export const gitIgnoredEntriesReaderLayer = (
  worktrees: ListedWorktrees,
  limits: Limits['git'],
) =>
  Layer.effect(
    IgnoredEntriesReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        read: Effect.fn('GitIgnoredEntriesReader.read')(
          (input: IgnoredEntriesReadInput) =>
            readGitEffect(
              input.worktreeId,
              Effect.gen(function* () {
                const checkout = yield* listedWorktreeEffect(
                  worktrees,
                  input.worktreeId,
                );
                return yield* checkIgnored(checkout.path, input.paths, limits);
              }).pipe(provideGit),
            ).pipe(Effect.orDie),
        ),
      };
    }),
  );
