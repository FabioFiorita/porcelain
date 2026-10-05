import { Effect } from 'effect';
import { ServiceNotManagedError } from '../errors/service-not-managed-error.ts';
import { ServiceUpdateNotOfferedError } from '../errors/service-update-not-offered-error.ts';
import { ServiceUpdateRunningError } from '../errors/service-update-running-error.ts';
import { UntrustedDeviceError } from '../errors/untrusted-device-error.ts';
import type {
  CheckServiceUpdateInput,
  ServiceUpdateRefusal,
} from '../models/service-update.ts';
import { serviceUpdateRefusal } from '../rules/service-update.ts';

export class CheckServiceUpdateService {
  execute(
    input: CheckServiceUpdateInput,
  ): Effect.Effect<
    void,
    | UntrustedDeviceError
    | ServiceNotManagedError
    | ServiceUpdateRunningError
    | ServiceUpdateNotOfferedError
  > {
    return Effect.gen({ self: this }, function* () {
      const refusal = serviceUpdateRefusal(
        input.state,
        input.target,
        input.authority,
      );
      if (refusal !== undefined)
        return yield* Effect.fail(this.failure(refusal));
    });
  }

  private failure(
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
}
