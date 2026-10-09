import { Effect } from 'effect';
import { HandedOffUpdateFailedError } from './errors/handed-off-update-failed-error.ts';
import { PublishedVersionUnknownError } from './errors/published-version-unknown-error.ts';
import { UpdateAlreadyRunningError } from './errors/update-already-running-error.ts';
import type { ServiceUpdates } from './service-update-runner.ts';

type UpdateToLatestInput = {
  check: Parameters<ServiceUpdates['read']>[0];
  pollMs: number;
  handingOff: (from: string, target: string) => void;
};

type LatestUpdateOutcome =
  | { kind: 'unmanaged' }
  | { kind: 'current'; version: string; latest: string }
  | { kind: 'updated'; from: string; target: string };

export const updateToLatest = Effect.fn('Installer.updateToLatest')(function* (
  updates: ServiceUpdates,
  input: UpdateToLatestInput,
) {
  const state = yield* updates.read(input.check);
  const from = state.version;
  if (!state.managed || from === undefined)
    return { kind: 'unmanaged' } satisfies LatestUpdateOutcome;
  if (state.running) return yield* Effect.fail(new UpdateAlreadyRunningError());
  const target = state.latest;
  if (target === undefined)
    return yield* Effect.fail(new PublishedVersionUnknownError());
  if (!state.available)
    return {
      kind: 'current',
      version: from,
      latest: target,
    } satisfies LatestUpdateOutcome;
  input.handingOff(from, target);
  yield* updates.start({ version: target });
  const last = yield* updates.awaitUpdate(input.pollMs);
  if (last?.target !== target)
    return yield* Effect.fail(
      new HandedOffUpdateFailedError({
        target,
        reason: 'the updater left no record of this update.',
      }),
    );
  if (last.stage !== 'updated')
    return yield* Effect.fail(
      new HandedOffUpdateFailedError({
        target,
        reason: last.reason ?? 'the updater gave no reason.',
      }),
    );
  return { kind: 'updated', from, target } satisfies LatestUpdateOutcome;
});
