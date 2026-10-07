import { Context, Effect, Layer } from 'effect';
import { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { AppManagedUpdateError } from './errors/app-managed-update-error.ts';

export const appManagedUpdateRunnerLayer = Layer.effect(
  ServiceUpdateRunner,
  Effect.sync(() => {
    return {
      read: () =>
        Effect.succeed({
          managed: false,
          version: undefined,
          latest: undefined,
          available: false,
          running: false,
          last: undefined,
        }),
      start: () => Effect.fail(new AppManagedUpdateError()).pipe(Effect.orDie),
      close: () => Effect.void,
    };
  }),
);

export const openAppManagedUpdateRunner = Effect.fn(
  'AppManagedUpdateRunner.open',
)(function* () {
  const context = yield* Layer.build(appManagedUpdateRunnerLayer);
  return Context.get(context, ServiceUpdateRunner);
});
