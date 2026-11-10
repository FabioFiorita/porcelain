import { Context, Effect, Layer } from 'effect';
import { EventPublisher } from '../../ports/event-publisher.ts';
export class AnnounceWalkthroughUseCase extends Context.Service<
  AnnounceWalkthroughUseCase,
  { readonly execute: (input: { worktreeId: string }) => Effect.Effect<void> }
>()('@porcelain/server/AnnounceWalkthroughUseCase') {
  static readonly layer = Layer.effect(
    AnnounceWalkthroughUseCase,
    Effect.gen(function* () {
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('AnnounceWalkthroughUseCase.execute')((input) =>
          events
            .worktreeChanged({ ...input, change: 'walkthrough' })
            .pipe(Effect.andThen(events.inventoryChanged())),
        ),
      };
    }),
  );
}
