import { type Cause, Effect, Fiber, Layer, Queue, Stream } from 'effect';
import { admittedWrite } from '@porcelain/effects/worktree';
import { GitActionRunner } from '@porcelain/git-actions/ports';
import type {
  GitActionExpectation,
  GitActionRunRequest,
  GitActionRunnerOutcome,
} from '@porcelain/git-actions/models';
import {
  executeGitAction,
  type GitActionExpectation as GitExpectation,
} from '@porcelain/git/actions';
import { makeGitSession } from '@porcelain/git/inspection';
import { readGitEffect } from '../../runtime/git-io.ts';
import type { Limits } from '../../config/limits.ts';
import { captureGitPlatform } from '../projects/git-platform.ts';
import {
  openCheckoutEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

export const gitGitActionRunnerLayer = (
  worktrees: ListedWorktrees,
  limits: Limits['git'],
) =>
  Layer.effect(
    GitActionRunner,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        run: Effect.fn('GitActionRunner.run')((input: GitActionRunRequest) =>
          admittedWrite(input.run.worktreeId, () =>
            readGitEffect(
              input.run.worktreeId,
              Effect.gen(function* () {
                const session = yield* makeGitSession(limits);
                const { checkout } = yield* openCheckoutEffect(
                  worktrees,
                  session,
                  input.run.worktreeId,
                );
                const onProgress = input.onProgress;
                const lines = yield* Queue.unbounded<string, Cause.Done>();
                const progress = yield* Effect.forkScoped(
                  Stream.runForEach(
                    Stream.fromQueue(lines),
                    onProgress ?? (() => Effect.void),
                  ),
                  { startImmediately: true },
                );
                const outcome = yield* executeGitAction(
                  checkout,
                  limits,
                  input.run.requestId,
                  input.run.intent,
                  gitExpectation(input.run.expected),
                  onProgress === undefined
                    ? undefined
                    : (line) => {
                        Queue.offerUnsafe(lines, line);
                      },
                ).pipe(
                  Effect.ensuring(
                    Effect.andThen(Queue.end(lines), Fiber.join(progress)),
                  ),
                );
                return {
                  kind: 'finished',
                  outcome,
                } satisfies GitActionRunnerOutcome;
              }).pipe(
                Effect.catchTag('GitActionRejectedError', (error) =>
                  Effect.succeed({
                    kind: 'refused' as const,
                    reason: error.reason,
                    detail: error.detail,
                  }),
                ),
                Effect.catchTag('GitTimeoutError', () =>
                  Effect.succeed({ kind: 'timed-out' as const }),
                ),
                Effect.scoped,
                provideGit,
              ),
            ),
          ),
        ),
      };
    }),
  );

function gitExpectation(expected: GitActionExpectation): GitExpectation {
  return {
    headOid: expected.headOid ?? null,
    branch: expected.branch ?? null,
    inProgress: expected.inProgress ?? null,
    mergeHeadOid: expected.mergeHeadOid ?? null,
    ...(expected.upstream === undefined
      ? {}
      : { upstreamOid: expected.upstream.oid ?? null }),
    ...(expected.files === undefined ? {} : { files: expected.files }),
  };
}
