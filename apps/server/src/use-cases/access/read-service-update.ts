import { Context, Effect, Layer } from 'effect';
import {
  AuthorizeServiceUpdateService,
  PlanServiceUpdateCheckService,
} from '@porcelain/access/services';
import {
  type ReadServiceUpdateRequest,
  type ReadServiceUpdateResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class ReadServiceUpdateUseCase extends Context.Service<
  ReadServiceUpdateUseCase,
  {
    readonly execute: (
      input: ReadServiceUpdateRequest,
    ) => Effect.Effect<ReadServiceUpdateResponse, never>;
  }
>()('@porcelain/server/ReadServiceUpdateUseCase') {
  static readonly layer = Layer.effect(
    ReadServiceUpdateUseCase,
    Effect.gen(function* () {
      const updatesCapability = yield* ServiceUpdateRunner;
      const authorizeServiceUpdateCapability =
        yield* AuthorizeServiceUpdateService;
      const planCheckCapability = yield* PlanServiceUpdateCheckService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadServiceUpdateUseCase.execute')(function* (
          input: ReadServiceUpdateRequest,
        ): Effect.fn.Return<ReadServiceUpdateResponse, never> {
          const check = yield* planCheckCapability.execute();
          const authority = yield* lanesCapability.run(
            laneKeysCapability.access(),
            'read',
            () =>
              Effect.gen(function* () {
                return yield* authorizeServiceUpdateCapability.execute(input);
              }),
          );
          return yield* lanesCapability.run(
            laneKeysCapability.serviceUpdate(),
            'read',
            () =>
              Effect.gen(function* () {
                return {
                  ...(yield* updatesCapability.read(check)),
                  ...authority,
                };
              }),
          );
        }),
      };
    }),
  );
}
