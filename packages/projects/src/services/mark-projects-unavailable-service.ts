import { Effect, Context, Layer } from 'effect';
import { InventoryStore } from '../ports/inventory-store.ts';

export class MarkProjectsUnavailableService extends Context.Service<
  MarkProjectsUnavailableService,
  { readonly execute: () => Effect.Effect<void, never> }
>()('@porcelain/projects/MarkProjectsUnavailableService') {
  static readonly layer = Layer.effect(
    MarkProjectsUnavailableService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('MarkProjectsUnavailableService.execute')(
          function* (): Effect.fn.Return<void, never> {
            return yield* Effect.sync<void>(() => {
              inventoryCapability.markAllUnavailable();
            });
          },
        ),
      };
    }),
  );
}
