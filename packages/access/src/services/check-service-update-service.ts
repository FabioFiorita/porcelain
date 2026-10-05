import { Effect, Context, Layer } from 'effect';
import { ServiceNotManagedError } from '../errors/service-not-managed-error.ts';
import { ServiceUpdateNotOfferedError } from '../errors/service-update-not-offered-error.ts';
import { ServiceUpdateRunningError } from '../errors/service-update-running-error.ts';
import { UntrustedDeviceError } from '../errors/untrusted-device-error.ts';
import type {
  CheckServiceUpdateInput,
  ServiceUpdateRefusal,
} from '../models/service-update.ts';
import { serviceUpdateRefusal } from '../rules/service-update.ts';

export class CheckServiceUpdateService extends Context.Service<
  CheckServiceUpdateService,
  {
    readonly execute: (
      input: CheckServiceUpdateInput,
    ) => Effect.Effect<
      void,
      | UntrustedDeviceError
      | ServiceNotManagedError
      | ServiceUpdateRunningError
      | ServiceUpdateNotOfferedError
    >;
  }
>()('@porcelain/access/CheckServiceUpdateService') {
  static readonly layer = Layer.effect(
    CheckServiceUpdateService,
    Effect.sync(() => {
      function operationFailure(
        problem: ServiceUpdateRefusal,
      ):
        | UntrustedDeviceError
        | ServiceNotManagedError
        | ServiceUpdateRunningError
        | ServiceUpdateNotOfferedError {
        switch (problem.kind) {
          case 'untrusted':
            return new UntrustedDeviceError();
          case 'unmanaged':
            return new ServiceNotManagedError();
          case 'running':
            return new ServiceUpdateRunningError();
          case 'not-offered':
            return new ServiceUpdateNotOfferedError();
        }
      }
      return {
        execute: Effect.fn('CheckServiceUpdateService.execute')(function* (
          input: CheckServiceUpdateInput,
        ): Effect.fn.Return<
          void,
          | UntrustedDeviceError
          | ServiceNotManagedError
          | ServiceUpdateRunningError
          | ServiceUpdateNotOfferedError
        > {
          const refusal = serviceUpdateRefusal(
            input.state,
            input.target,
            input.authority,
          );
          if (refusal !== undefined)
            return yield* Effect.fail(operationFailure(refusal));
        }),
      };
    }),
  );
}
