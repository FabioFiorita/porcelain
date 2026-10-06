import { Context, Effect, Layer } from 'effect';
import { ListAccessService } from '@porcelain/access/services';
import {
  type ListAccessRequest,
  type ListAccessResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ListAccessUseCase extends Context.Service<
  ListAccessUseCase,
  {
    readonly execute: (
      input: ListAccessRequest,
    ) => Effect.Effect<ListAccessResponse, never>;
  }
>()('@porcelain/server/ListAccessUseCase') {
  static readonly layer = Layer.effect(
    ListAccessUseCase,
    Effect.gen(function* () {
      const listAccessCapability = yield* ListAccessService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ListAccessUseCase.execute')(function* (
          input: ListAccessRequest,
        ): Effect.fn.Return<ListAccessResponse, never> {
          const { viewer } = input;
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'read',
            () =>
              Effect.gen(function* () {
                return yield* listAccessCapability.execute({
                  viewerDeviceId:
                    viewer.kind === 'device' ? viewer.deviceId : undefined,
                });
              }),
          );
        }),
      };
    }),
  );
}
