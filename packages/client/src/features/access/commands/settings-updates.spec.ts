import { it } from '@effect/vitest';
import { Clock, Effect, Layer, Schema, Stream } from 'effect';
import { readServiceUpdateResponseSchema } from '@porcelain/contracts/access';
import { AtomRegistry } from 'effect/reactivity';
import { TestClock } from 'effect/testing';
import { expect } from 'vitest';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import {
  runSettingsUpdates,
  settingsUpdateBatch,
  settingsUpdateBatchProgress,
  SettingsUpdateError,
  type ServiceUpdateTarget,
  type MacAppUpdateTarget,
  type SettingsUpdateBatch,
} from '../index.ts';

const fixture = clientFixtures();
const offered: ServiceUpdateTarget['state'] = {
  managed: true,
  available: true,
  canUpdate: true,
  running: false,
  version: '1.0.0',
  latest: '1.1.0',
  last: undefined,
};
const running = {
  ...offered,
  running: true,
  last: {
    from: '1.0.0',
    target: '1.1.0',
    stage: 'downloading' as const,
    reason: undefined,
  },
};
function response(state: ServiceUpdateTarget['state'], status = 200) {
  return Response.json(
    Schema.encodeSync(readServiceUpdateResponseSchema)(state),
    { status },
  );
}

function waitForBatch(
  registry: AtomRegistry.AtomRegistry,
  predicate: (batch: SettingsUpdateBatch) => boolean,
) {
  return AtomRegistry.toStream(registry, settingsUpdateBatch).pipe(
    Stream.filter(predicate),
    Stream.take(1),
    Stream.runDrain,
  );
}

it.effect(
  'waits for actual completion, continues after failure, keeps Mac last, and retains progress across view unmounts without overlapping clicks',
  () =>
    Effect.gen(function* () {
      const writes: string[] = [];
      let postedFirst: (() => void) | undefined;
      const firstPosted = new Promise<void>((resolve) => {
        postedFirst = resolve;
      });
      let postedSecond: (() => void) | undefined;
      const secondPosted = new Promise<void>((resolve) => {
        postedSecond = resolve;
      });
      let firstState: ServiceUpdateTarget['state'] = running;
      let secondState: ServiceUpdateTarget['state'] = running;
      let secondUnavailable = false;
      const first = fixture(async (_path, init) => {
        if (init?.method === 'POST') {
          writes.push('first');
          postedFirst?.();
          return response(running, 202);
        }
        return response(firstState);
      });
      const second = fixture(async (_path, init) => {
        if (init?.method === 'POST') {
          writes.push('second');
          postedSecond?.();
          return response(running, 202);
        }
        return secondUnavailable
          ? new Response(null, { status: 503 })
          : response(secondState);
      });
      for (const { connection } of [first, second])
        connection.atoms.addGlobalLayer(
          Layer.succeed(Clock.Clock, yield* Clock.Clock),
        );
      const registry = first.registry;
      const rows: readonly ServiceUpdateTarget[] = [first, second].map(
        ({ connection }, index) => ({
          kind: 'service',
          id: String(index),
          name: index === 0 ? 'First' : 'Second',
          deviceId: undefined,
          connection,
          state: offered,
        }),
      );
      let finishMac: (() => void) | undefined;
      const mac: MacAppUpdateTarget = {
        kind: 'mac-app',
        id: 'mac',
        name: 'Mac app',
        available: true,
        latest: '1.1.0',
        update: (version) =>
          Effect.promise(() => {
            writes.push(`mac:${version}`);
            return new Promise<void>((resolve) => {
              finishMac = resolve;
            });
          }),
      };
      const unmountAction = registry.mount(runSettingsUpdates);
      const unmountProgress = registry.mount(settingsUpdateBatch);
      registry.set(runSettingsUpdates, [mac, ...rows, ...rows]);
      yield* Effect.promise(() => firstPosted);
      yield* TestClock.adjust(0);
      expect(writes).toEqual(['first']);
      expect(
        registry.get(settingsUpdateBatch).entries.map((entry) => entry.status),
      ).toEqual(['updating', 'queued', 'queued']);
      expect(
        settingsUpdateBatchProgress(registry.get(settingsUpdateBatch)),
      ).toEqual({ total: 3, current: 1, label: 'Updating 1 of 3' });
      unmountAction();
      unmountProgress();
      registry.set(runSettingsUpdates, rows);
      yield* TestClock.adjust(1000);
      expect(writes).toEqual(['first']);
      expect(registry.get(settingsUpdateBatch).running).toBe(true);
      firstState = {
        ...running,
        running: false,
        last: { ...running.last, stage: 'failed', reason: 'npm failed' },
      };
      yield* TestClock.adjust(1000);
      yield* Effect.promise(() => secondPosted);
      yield* TestClock.adjust(0);
      expect(writes).toEqual(['first', 'second']);
      expect(registry.get(settingsUpdateBatch).entries[0]).toMatchObject({
        status: 'failed',
        message: 'npm failed',
      });
      expect(
        settingsUpdateBatchProgress(registry.get(settingsUpdateBatch)).label,
      ).toBe('Updating 2 of 3');
      secondUnavailable = true;
      yield* TestClock.adjust(1000);
      expect(writes).toEqual(['first', 'second']);
      secondUnavailable = false;
      secondState = {
        ...running,
        running: false,
        last: { ...running.last, stage: 'updated' },
      };
      yield* TestClock.adjust(1000);
      expect(writes).toEqual(['first', 'second']);
      secondState = { ...secondState, version: '1.1.0', available: false };
      yield* TestClock.adjust(1000);
      yield* waitForBatch(
        registry,
        (batch) => batch.entries[2]?.status === 'updating',
      );
      expect(writes).toEqual(['first', 'second', 'mac:1.1.0']);
      expect(registry.get(settingsUpdateBatch).entries[1]?.status).toBe(
        'updated',
      );
      finishMac?.();
      yield* waitForBatch(registry, (batch) => !batch.running);
      expect(
        registry.get(settingsUpdateBatch).entries.map((entry) => entry.status),
      ).toEqual(['failed', 'updated', 'updated']);
    }),
);

it.effect(
  'does not send excluded rows and continues to a Mac adapter after a rejected POST',
  () =>
    Effect.gen(function* () {
      const writes: string[] = [];
      const subject = fixture(async (_path, init) => {
        if (init?.method === 'POST') {
          writes.push('service');
          return new Response(null, { status: 403 });
        }
        return response(offered);
      });
      const target: ServiceUpdateTarget = {
        kind: 'service',
        id: 'a',
        name: 'A',
        connection: subject.connection,
        deviceId: undefined,
        state: offered,
      };
      const mac: MacAppUpdateTarget = {
        kind: 'mac-app',
        id: 'mac',
        name: 'Mac app',
        available: true,
        latest: '1.1.0',
        update: () =>
          Effect.sync(() => {
            writes.push('mac');
          }).pipe(
            Effect.andThen(
              new SettingsUpdateError({ message: 'Download failed' }),
            ),
          ),
      };
      subject.registry.set(runSettingsUpdates, [
        { ...target, id: 'unmanaged', state: { ...offered, managed: false } },
        { ...target, id: 'untrusted', state: { ...offered, canUpdate: false } },
        { ...target, id: 'current', state: { ...offered, available: false } },
        target,
        mac,
      ]);
      yield* AtomRegistry.getResult(subject.registry, runSettingsUpdates, {
        suspendOnWaiting: true,
      });
      expect(writes).toEqual(['service', 'mac']);
      expect(subject.registry.get(settingsUpdateBatch)).toMatchObject({
        running: false,
        entries: [
          { id: 'a', status: 'failed' },
          { id: 'mac', status: 'failed', message: 'Download failed' },
        ],
      });
    }),
);
