import { Effect, Layer } from 'effect';
import { SelectedDiffReader } from '@porcelain/git-actions/ports';
import type { SelectedDiffRequest } from '@porcelain/git-actions/models';
import { makeGitSession, readSelectedDiff } from '@porcelain/git/inspection';
import { readGitEffect } from '../../runtime/git-io.ts';
import type { Limits } from '../../config/limits.ts';
import { captureGitPlatform } from '../projects/git-platform.ts';
import {
  openCheckoutEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export const gitSelectedDiffReaderLayer = (
  worktrees: ListedWorktrees,
  limits: Limits['git'],
) =>
  Layer.effect(
    SelectedDiffReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        read: Effect.fn('SelectedDiffReader.read')(
          (input: SelectedDiffRequest) =>
            readGitEffect(
              input.worktreeId,
              Effect.gen(function* () {
                const session = yield* makeGitSession(limits);
                const { checkout } = yield* openCheckoutEffect(
                  worktrees,
                  session,
                  input.worktreeId,
                );
                return yield* readSelectedDiff(
                  checkout,
                  input.headOid ?? null,
                  input.paths,
                  limits,
                );
              }).pipe(provideGit),
            ),
        ),
      };
    }),
  );
