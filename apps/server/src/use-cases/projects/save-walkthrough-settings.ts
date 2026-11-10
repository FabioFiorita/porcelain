import { Context, Effect, Layer } from 'effect';
import { CheckProjectService } from '@porcelain/projects/services';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { SaveWalkthroughSettingsService } from '@porcelain/walkthroughs/services';
import type {
  RenameProjectParams,
  WalkthroughSettings,
} from '@porcelain/contracts/projects';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
export class SaveWalkthroughSettingsUseCase extends Context.Service<
  SaveWalkthroughSettingsUseCase,
  {
    readonly execute: (
      input: RenameProjectParams & WalkthroughSettings,
    ) => Effect.Effect<WalkthroughSettings, ProjectNotFoundError>;
  }
>()('@porcelain/server/SaveWalkthroughSettingsUseCase') {
  static readonly layer = Layer.effect(
    SaveWalkthroughSettingsUseCase,
    Effect.gen(function* () {
      const inventory = yield* CheckProjectService;
      const store = yield* SaveWalkthroughSettingsService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('SaveWalkthroughSettingsUseCase.execute')(
          function* (input) {
            yield* lanes.run(keys.inventory(), 'read', () =>
              inventory.execute(input),
            );
            yield* lanes.run(keys.walkthroughs(), 'write', () =>
              store.execute({
                projectId: input.projectId,
                settings: { mode: input.mode, provider: input.provider },
              }),
            );
            yield* events.inventoryChanged();
            return { mode: input.mode, provider: input.provider };
          },
        ),
      };
    }),
  );
}
