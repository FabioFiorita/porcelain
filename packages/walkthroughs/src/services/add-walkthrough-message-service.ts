import { Context, DateTime, Effect, Layer } from 'effect';
import { IdSource } from '@porcelain/kernel/ports';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
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
    }) => Effect.Effect<string, WalkthroughTargetNotFoundError>;
  }
>()('@porcelain/walkthroughs/AddWalkthroughMessageService') {
  static readonly layer = Layer.effect(
    AddWalkthroughMessageService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const ids = yield* IdSource;
      return {
        execute: Effect.fn('AddWalkthroughMessageService.execute')(
          function* (input) {
            const job = yield* store.readJob(input.runId);
            if (
              job === undefined ||
              job.run.worktreeId !== input.worktreeId ||
              job.run.state.status !== 'ready'
            )
              return yield* new WalkthroughTargetNotFoundError();
            const { anchor } = input;
            if (
              anchor.kind === 'stop' &&
              !job.run.state.content.stops.some(
                (stop) => stop.title === anchor.title,
              )
            )
              return yield* new WalkthroughTargetNotFoundError();
            const id = ids.next();
            yield* store.addMessage({
              id,
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
