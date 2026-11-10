import { Context, DateTime, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughWriter } from '../ports/walkthrough-writer.ts';
import { WalkthroughFailedError } from '../errors/walkthrough-failed-error.ts';
export class AnswerWalkthroughMessageService extends Context.Service<
  AnswerWalkthroughMessageService,
  { readonly execute: () => Effect.Effect<string | undefined> }
>()('@porcelain/walkthroughs/AnswerWalkthroughMessageService') {
  static readonly layer = Layer.effect(
    AnswerWalkthroughMessageService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const writer = yield* WalkthroughWriter;
      return {
        execute: Effect.fn('AnswerWalkthroughMessageService.execute')(
          function* () {
            const message = yield* store.readOldestAnswering();
            if (message === undefined) return undefined;
            yield* Effect.gen(function* () {
              const job = yield* store.readJob(message.runId);
              if (job === undefined || job.run.state.status !== 'ready')
                return yield* new WalkthroughFailedError({
                  kind: 'other',
                  message: 'This walkthrough is no longer available.',
                });
              const result = yield* writer.answer({
                run: job.run,
                content: job.run.state.content,
                worktreePath: job.worktreePath,
                stopTitle: message.stopTitle,
                text: message.text,
              });
              if (result.sessionId !== job.run.sessionId)
                yield* store.save({ ...job.run, sessionId: result.sessionId });
              yield* store.settleAnswer(message.id, {
                status: 'answered',
                text: result.text,
                answeredAt: yield* DateTime.now.pipe(
                  Effect.map(DateTime.formatIso),
                ),
                durationMs: result.durationMs,
                costUsd: result.costUsd,
              });
            }).pipe(
              Effect.catch((failure) =>
                store.settleAnswer(message.id, {
                  status: 'failed',
                  failure: { kind: failure.kind, message: failure.message },
                }),
              ),
              Effect.onInterrupt(() =>
                store.settleAnswer(message.id, {
                  status: 'failed',
                  failure: {
                    kind: 'other',
                    message: 'This answer was interrupted. Ask again.',
                  },
                }),
              ),
            );
            return message.worktreeId;
          },
        ),
      };
    }),
  );
}
