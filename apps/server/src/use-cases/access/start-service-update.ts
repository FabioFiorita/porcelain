import { Context, Effect, Layer } from 'effect';
import {
  type UntrustedDeviceError,
  type ServiceNotManagedError,
  type ServiceUpdateRunningError,
  type ServiceUpdateNotOfferedError,
} from '@porcelain/access/errors';
import {
  AuthorizeServiceUpdateService,
  CheckServiceUpdateService,
  PlanServiceUpdateCheckService,
} from '@porcelain/access/services';
import {
  type StartServiceUpdateInput,
  type StartServiceUpdateResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class StartServiceUpdateUseCase extends Context.Service<
  StartServiceUpdateUseCase,
  {
    readonly execute: (
      input: StartServiceUpdateInput,
    ) => Effect.Effect<
      StartServiceUpdateResponse,
      | UntrustedDeviceError
      | ServiceNotManagedError
      | ServiceUpdateRunningError
      | ServiceUpdateNotOfferedError
    >;
  }
>()('@porcelain/server/StartServiceUpdateUseCase') {
  static readonly layer = Layer.effect(
    StartServiceUpdateUseCase,
    Effect.gen(function* () {
      const updatesCapability = yield* ServiceUpdateRunner;
      const authorizeServiceUpdateCapability =
        yield* AuthorizeServiceUpdateService;
      const checkServiceUpdateCapability = yield* CheckServiceUpdateService;
      const planCheckCapability = yield* PlanServiceUpdateCheckService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('StartServiceUpdateUseCase.execute')(function* (
          input: StartServiceUpdateInput,
        ): Effect.fn.Return<
          StartServiceUpdateResponse,
          | UntrustedDeviceError
          | ServiceNotManagedError
          | ServiceUpdateRunningError
          | ServiceUpdateNotOfferedError
        > {
          const check = yield* planCheckCapability.execute();
          const target = { version: input.version };
          const authority = yield* lanesCapability.run(
            laneKeysCapability.access(),
            'read',
            () =>
              Effect.gen(function* () {
                return yield* authorizeServiceUpdateCapability.execute({
                  viewer: input.viewer,
                  local: input.local,
                });
              }),
          );
          return yield* lanesCapability.run(
            laneKeysCapability.serviceUpdate(),
            'write',
            () =>
              Effect.gen(function* () {
                yield* checkServiceUpdateCapability.execute({
                  authority,
                  state: yield* updatesCapability.read(check),
                  target,
                });
                yield* updatesCapability.start(target);
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
