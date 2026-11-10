import { ReadWalkthroughService } from './read-walkthrough-service.ts';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { Context, DateTime, Effect, Layer } from 'effect';
import { IdSource } from '@porcelain/kernel/ports';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughRun } from '../models/walkthrough.ts';
import type { ConversationAnchor } from '../models/conversation.ts';
import { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
export class AddWalkthroughMessageService extends Context.Service<
  AddWalkthroughMessageService,
  {
    readonly execute: (input: {
      worktreeId: string;
      runId: string;
      anchor: ConversationAnchor;
      text: string;
      writer?: WalkthroughRun['writer'] | undefined;
    }) => Effect.Effect<
      string,
      WalkthroughTargetNotFoundError | GitIoFailure,
      WorktreeRead
    >;
  }
>()('@porcelain/walkthroughs/AddWalkthroughMessageService') {
  static readonly layer = Layer.effect(
    AddWalkthroughMessageService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const current = yield* ReadWalkthroughService;
      const ids = yield* IdSource;
      return {
        execute: Effect.fn('AddWalkthroughMessageService.execute')(
          function* (input) {
            const { readyRuns } = yield* current.execute(input);
            const run = readyRuns.find(
              (candidate) => candidate.id === input.runId,
            );
            if (run === undefined || run.state.status !== 'ready')
              return yield* new WalkthroughTargetNotFoundError();
            const { anchor } = input;
            if (
              anchor.kind === 'stop' &&
              !run.state.content.stops.some(
                (stop) => stop.title === anchor.title,
              )
            )
              return yield* new WalkthroughTargetNotFoundError();
            const id = ids.next();
            yield* store.addMessage({
              id,
              writer: input.writer,
              runId: input.runId,
              worktreeId: input.worktreeId,
              stopTitle: anchor.kind === 'stop' ? anchor.title : undefined,
              text: input.text,
              createdAt: yield* DateTime.now.pipe(
                Effect.map(DateTime.formatIso),
              ),
              post: { status: 'none' },
              answer: { status: 'answering' },
            });
            return id;
          },
        ),
      };
    }),
  );
}
