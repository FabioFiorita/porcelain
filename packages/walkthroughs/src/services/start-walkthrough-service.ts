import { Context, DateTime, Effect, Layer } from 'effect';
import { IdSource } from '@porcelain/kernel/ports';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { GitIoFailure } from '@porcelain/git/errors';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughSourceReader } from '../ports/walkthrough-source-reader.ts';
import type { WalkthroughRun } from '../models/walkthrough.ts';
import type { WalkthroughFailedError } from '../errors/walkthrough-failed-error.ts';
export class StartWalkthroughService extends Context.Service<
  StartWalkthroughService,
  {
    readonly execute: (input: {
      automaticKey?: string;
      worktreeId: string;
      worktreePath: string;
      projectId: string;
      base: string | undefined;
      pullRequestNumber: number | undefined;
      writer: WalkthroughRun['writer'] | undefined;
    }) => Effect.Effect<
      WalkthroughRun,
      GitIoFailure | WalkthroughFailedError,
      WorktreeRead
    >;
  }
>()('@porcelain/walkthroughs/StartWalkthroughService') {
  static readonly layer = Layer.effect(
    StartWalkthroughService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const source = yield* WalkthroughSourceReader;
      const ids = yield* IdSource;
      return {
        execute: Effect.fn('StartWalkthroughService.execute')(
          function* (input) {
            const snapshot = yield* source.read(input);
            const createdAt = yield* DateTime.now.pipe(
              Effect.map(DateTime.formatIso),
            );
            return yield* store.accept(
              {
                worktreePath: input.worktreePath,
                files: snapshot.files,
                run: {
                  id: ids.next(),
                  projectId: input.projectId,
                  worktreeId: input.worktreeId,
                  pullRequestNumber: input.pullRequestNumber,
                  baseOid: snapshot.baseOid,
                  headOid: snapshot.headOid,
                  writer: input.writer ?? {
                    provider: 'claude',
                    model: 'claude-opus-5-5',
                  },
                  sessionId: undefined,
                  createdAt,
                  state: { status: 'queued' },
                },
              },
              input.automaticKey,
            );
          },
        ),
      };
    }),
  );
}
