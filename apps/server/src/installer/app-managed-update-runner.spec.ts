import { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { describe, expect, it } from '@effect/vitest';
import { Cause, Effect, Exit } from 'effect';
import { appManagedUpdateRunnerLayer } from './app-managed-update-runner.ts';

describe('appManagedUpdateRunnerLayer', () => {
  const check = {
    now: '2026-10-01T00:00:00.000Z',
    staleBefore: '2026-09-30T23:00:00.000Z',
  };

  it.effect(
    'reports a server the service updater does not manage, with nothing to offer',
    () =>
      Effect.gen(function* () {
        const runner = yield* ServiceUpdateRunner;
        expect(yield* runner.read(check)).toEqual({
          managed: false,
          version: undefined,
          latest: undefined,
          available: false,
          running: false,
          last: undefined,
        });
        yield* runner.close();
        expect(yield* runner.read(check)).toEqual({
          managed: false,
          version: undefined,
          latest: undefined,
          available: false,
          running: false,
          last: undefined,
        });
      }).pipe(Effect.provide(appManagedUpdateRunnerLayer)),
  );

  it.effect(
    'refuses to start a service update and says the app updates its server',
    () =>
      Effect.gen(function* () {
        const runner = yield* ServiceUpdateRunner;
        const result = yield* Effect.exit(runner.start({ version: '9.9.9' }));
        expect(Exit.isFailure(result)).toBe(true);
        if (Exit.isFailure(result)) {
          expect(Cause.hasDies(result.cause)).toBe(true);
          expect(Cause.squash(result.cause)).toHaveProperty(
            'message',
            'This server runs inside the Porcelain app, which updates it with the app; the service updater does not run here.',
          );
        }
      }).pipe(Effect.provide(appManagedUpdateRunnerLayer)),
  );
});
