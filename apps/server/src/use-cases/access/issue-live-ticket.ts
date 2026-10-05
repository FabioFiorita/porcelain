import { Context, Effect, Layer } from 'effect';
import {
  type DeviceViewerRequiredError,
  type TooManyLiveTicketsError,
} from '@porcelain/access/errors';
import { IssueLiveTicketService } from '@porcelain/access/services';
import {
  type IssueLiveTicketRequest,
  type IssueLiveTicketResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class IssueLiveTicketUseCase extends Context.Service<
  IssueLiveTicketUseCase,
  {
    readonly execute: (
      input: IssueLiveTicketRequest,
    ) => Effect.Effect<
      IssueLiveTicketResponse,
      DeviceViewerRequiredError | TooManyLiveTicketsError
    >;
  }
>()('@porcelain/server/IssueLiveTicketUseCase') {
  static readonly layer = Layer.effect(
    IssueLiveTicketUseCase,
    Effect.gen(function* () {
      const issueLiveTicketCapability = yield* IssueLiveTicketService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('IssueLiveTicketUseCase.execute')(function* (
          input: IssueLiveTicketRequest,
        ): Effect.fn.Return<
          IssueLiveTicketResponse,
          DeviceViewerRequiredError | TooManyLiveTicketsError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                return yield* issueLiveTicketCapability.execute(input);
              }),
          );
        }),
      };
    }),
  );
}
