import { Context, Effect, Layer } from 'effect';
import type { SaveDefaultWalkthroughWriterRequest } from '@porcelain/contracts/walkthroughs';
import { SaveDefaultWalkthroughWriterService } from '@porcelain/walkthroughs/services';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
export class SaveDefaultWalkthroughWriterUseCase extends Context.Service<
  SaveDefaultWalkthroughWriterUseCase,
  {
    readonly execute: (
      input: SaveDefaultWalkthroughWriterRequest,
    ) => Effect.Effect<SaveDefaultWalkthroughWriterRequest>;
  }
>()('@porcelain/server/SaveDefaultWalkthroughWriterUseCase') {
  static readonly layer = Layer.effect(
    SaveDefaultWalkthroughWriterUseCase,
    Effect.gen(function* () {
      const service = yield* SaveDefaultWalkthroughWriterService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('SaveDefaultWalkthroughWriterUseCase.execute')(
          function* (input: SaveDefaultWalkthroughWriterRequest) {
            const result = yield* lanes.run(keys.walkthroughs(), 'write', () =>
              service.execute(input),
            );
            yield* events.inventoryChanged();
            return result;
          },
        ),
      };
    }),
  );
}
