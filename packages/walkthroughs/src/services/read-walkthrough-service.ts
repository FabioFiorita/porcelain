import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughHeadReader } from '../ports/walkthrough-head-reader.ts';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { WalkthroughRun } from '../models/walkthrough.ts';
export class ReadWalkthroughService extends Context.Service<
  ReadWalkthroughService,
  {
    readonly execute: (input: { worktreeId: string }) => Effect.Effect<
      {
        walkthrough: WalkthroughRun | undefined;
        attempt: WalkthroughRun | undefined;
        outOfDate: boolean;
      },
      GitIoFailure,
      WorktreeRead
    >;
  }
>()('@porcelain/walkthroughs/ReadWalkthroughService') {
  static readonly layer = Layer.effect(
    ReadWalkthroughService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const heads = yield* WalkthroughHeadReader;
      return {
        execute: Effect.fn('ReadWalkthroughService.execute')(function* (input) {
          const head = yield* heads.read(input);
          const latest = yield* store.read(input.worktreeId, {
            branch: head.branch,
          });
          const readyRuns = (yield* store.listReadyRuns(
            input.worktreeId,
          )).filter((run) => run.branch === head.branch);
          const ready = readyRuns.at(-1);
          const walkthrough =
            latest?.state.status === 'ready' ? latest : (ready ?? latest);
          const job =
            walkthrough === undefined
              ? undefined
              : yield* store.readJob(walkthrough.id);
          const identity =
            job === undefined
              ? undefined
              : yield* heads.content({
                  worktreeId: input.worktreeId,
                  worktreePath: job.worktreePath,
                  baseRef: job.run.baseRef,
                });
          return {
            walkthrough,
            outOfDate:
              walkthrough !== undefined &&
              (identity?.baseOid !== walkthrough.baseOid ||
                identity?.contentTreeOid !== walkthrough.contentTreeOid),
            attempt:
              ready !== undefined &&
              latest !== undefined &&
              latest.state.status !== 'ready' &&
              latest.id !== ready.id
                ? latest
                : undefined,
          };
        }),
      };
    }),
  );
}
