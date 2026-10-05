import { Context, Effect, Layer } from 'effect';
import {
  type AuthenticatedDevice,
  type RedeemLiveTicketInput,
} from '@porcelain/access/models';
import { RedeemLiveTicketService } from '@porcelain/access/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RedeemLiveTicketUseCase extends Context.Service<
  RedeemLiveTicketUseCase,
  {
    readonly execute: (
      input: RedeemLiveTicketInput,
    ) => Effect.Effect<AuthenticatedDevice | undefined, never>;
  }
>()('@porcelain/server/RedeemLiveTicketUseCase') {
  static readonly layer = Layer.effect(
    RedeemLiveTicketUseCase,
    Effect.gen(function* () {
      const redeemLiveTicketCapability = yield* RedeemLiveTicketService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('RedeemLiveTicketUseCase.execute')(function* (
          input: RedeemLiveTicketInput,
        ): Effect.fn.Return<AuthenticatedDevice | undefined, never> {
          const result = yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                return yield* redeemLiveTicketCapability.execute(input);
              }),
          );
          return result.kind === 'authenticated'
            ? { deviceId: result.deviceId }
            : undefined;
        }),
      };
    }),
  );
}
