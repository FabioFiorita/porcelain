import { Context, Effect, Layer } from 'effect';
import { EventPublisher } from '../../ports/event-publisher.ts';
export class AnnounceWalkthroughUseCase extends Context.Service<
  AnnounceWalkthroughUseCase,
  {
    readonly execute: (input: {
      worktreeId: string;
      change?: 'walkthrough-conversations';
    }) => Effect.Effect<void>;
  }
>()('@porcelain/server/AnnounceWalkthroughUseCase') {
  static readonly layer = Layer.effect(
    AnnounceWalkthroughUseCase,
    Effect.gen(function* () {
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('AnnounceWalkthroughUseCase.execute')((input) =>
          events
            .worktreeChanged({
              worktreeId: input.worktreeId,
              change: input.change ?? 'walkthrough',
            })
            .pipe(
              Effect.andThen(
                input.change === undefined
                  ? events.inventoryChanged()
                  : Effect.void,
              ),
            ),
        ),
      };
    }),
  );
}
