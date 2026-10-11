import { Context, Effect, Layer } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { InventoryScan } from '../../ports/inventory-scan.ts';
import { ReadInventoryUseCasePort } from '../../ports/read-inventory-use-case-port.ts';

export class RefreshInventoryUseCase extends Context.Service<
  RefreshInventoryUseCase,
  {
    readonly execute: () => Effect.Effect<
      ReadInventoryResponse,
      MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/RefreshInventoryUseCase') {
  static readonly layer = Layer.effect(
    RefreshInventoryUseCase,
    Effect.gen(function* () {
      const scan = yield* InventoryScan;
      const read = yield* ReadInventoryUseCasePort;
      return {
        execute: Effect.fn('RefreshInventoryUseCase.execute')(function* () {
          yield* scan
            .execute()
            .pipe(Effect.catchTag('ProjectNotFoundError', () => Effect.void));
          return yield* read.execute();
        }),
      };
    }),
  );
}
