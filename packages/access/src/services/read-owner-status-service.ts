import { Effect, Context, Layer } from 'effect';
import type { ReadOwnerStatusResult } from '../models/read-owner-status.ts';
import { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';

export class ReadOwnerStatusService extends Context.Service<
  ReadOwnerStatusService,
  { readonly execute: () => Effect.Effect<ReadOwnerStatusResult, never> }
>()('@porcelain/access/ReadOwnerStatusService') {
  static readonly layer = Layer.effect(
    ReadOwnerStatusService,
    Effect.gen(function* () {
      const runtimeStatusReader = yield* RuntimeStatusReader;

      return {
        execute: Effect.fn('ReadOwnerStatusService.execute')(
          function* (): Effect.fn.Return<ReadOwnerStatusResult, never> {
            return yield* Effect.sync<ReadOwnerStatusResult>(() => {
              return runtimeStatusReader.current();
            });
          },
        ),
      };
    }),
  );
}
