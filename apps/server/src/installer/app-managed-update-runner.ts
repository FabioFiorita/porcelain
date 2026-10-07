import { Effect } from 'effect';
import type { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { AppManagedUpdateError } from './errors/app-managed-update-error.ts';

type ServiceUpdateState = Effect.Success<
  ReturnType<ServiceUpdateRunner['read']>
>;

class AppManagedUpdateRunner implements ServiceUpdateRunner {
  read(): Effect.Effect<ServiceUpdateState> {
    return Effect.succeed({
      managed: false,
      version: undefined,
      latest: undefined,
      available: false,
      running: false,
      last: undefined,
    });
  }

  start(): Effect.Effect<void> {
    return Effect.fail(new AppManagedUpdateError()).pipe(Effect.orDie);
  }

  close(): Effect.Effect<void> {
    return Effect.void;
  }
}

export function openAppManagedUpdateRunner(): ServiceUpdateRunner {
  return new AppManagedUpdateRunner();
}
