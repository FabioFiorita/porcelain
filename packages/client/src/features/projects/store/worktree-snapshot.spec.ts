import { Effect, Layer, Redacted } from 'effect';
import { expect, it } from 'vite-plus/test';
import { AccessStore } from '../../access/store.ts';
import { EnvironmentStorage } from '../../access/ports/environment-storage.ts';
import type { Remote } from '../../access/rules/remotes.ts';
import { WorktreeSnapshotStorage } from '../ports/worktree-snapshot-storage.ts';
import { projectWorktreeSnapshot } from '../rules/worktree-snapshot.ts';
import { WorktreeSnapshots } from './worktree-snapshot.ts';

const paired = (deviceId: string): Remote => ({
  environmentId: 'computer-1',
  name: 'Office',
  address: 'http://office.local:4738',
  credential: Redacted.make('fixture-credential'),
  deviceId,
});

const projectId = '30000000-0000-4000-8000-000000000001';
const mainId = 'a'.repeat(32);
const topicId = 'b'.repeat(32);
const inventory = {
  environmentId: 'computer-1',
  environment: { name: 'Office', custom: true },
  projects: [
    {
      id: projectId,
      name: 'App',
      available: true,
      worktrees: [
        {
          id: topicId,
          path: '/private/checkout/topic',
          branch: 'topic',
          main: false,
          available: true,
        },
        {
          id: mainId,
          path: '/private/checkout/main',
          branch: 'main',
          main: true,
          available: true,
        },
      ],
    },
  ],
};

function fixture<A, E>(
  test: (
    records: Map<string, string>,
  ) => Effect.Effect<A, E, AccessStore | WorktreeSnapshots>,
) {
  const records = new Map<string, string>();
  const environments = Layer.succeed(EnvironmentStorage, {
    read: () =>
      Effect.succeed({ remotes: [paired('original')], missingCredentials: [] }),
    write: () => Effect.void,
  });
  const storage = Layer.succeed(WorktreeSnapshotStorage, {
    read: (key) => Effect.sync(() => records.get(key) ?? null),
    write: (key, value) =>
      Effect.sync(() => {
        records.set(key, value);
      }),
    remove: (key) =>
      Effect.sync(() => {
        records.delete(key);
      }),
  });
  return test(records).pipe(
    Effect.provide(
      WorktreeSnapshots.layer.pipe(
        Layer.provideMerge(AccessStore.layer.pipe(Layer.provide(environments))),
        Layer.provide(storage),
      ),
    ),
    Effect.runPromise,
  );
}

it('stores Worktrees labels in order without checkout paths or credentials', async () => {
  const { saved, record } = await fixture((records) =>
    Effect.gen(function* () {
      const access = yield* AccessStore;
      const snapshots = yield* WorktreeSnapshots;
      yield* access.load();
      yield* snapshots.write(
        'computer-1',
        projectWorktreeSnapshot(inventory, '["original"]', 10),
      );
      return {
        saved: yield* snapshots.read('computer-1', '["original"]'),
        record: records.get('computer-1'),
      };
    }),
  );
  expect(saved).toEqual({
    version: 1,
    pairing: '["original"]',
    confirmedAt: 10,
    computerName: 'Office',
    rows: [
      {
        projectId,
        projectName: 'App',
        worktreeId: mainId,
        title: 'main',
        checkout: {
          name: 'main',
          branch: 'main',
          main: true,
          detached: false,
        },
      },
      {
        projectId,
        projectName: 'App',
        worktreeId: topicId,
        title: 'topic',
        checkout: {
          name: 'topic',
          branch: 'topic',
          main: false,
          detached: false,
        },
      },
    ],
  });
  expect(record).not.toMatch(/private|fixture-credential/);
});

it('drops corrupt data and blocks old writes after re-pairing or forgetting', async () => {
  const result = await fixture((records) =>
    Effect.gen(function* () {
      const access = yield* AccessStore;
      const snapshots = yield* WorktreeSnapshots;
      yield* access.load();
      records.set('computer-1', '{');
      const corrupt = yield* snapshots.read('computer-1', '["original"]');
      const afterCorrupt = records.has('computer-1');
      const old = projectWorktreeSnapshot(inventory, '["original"]', 10);
      yield* snapshots.write('computer-1', old);
      yield* access.save(paired('replacement'));
      const previous = yield* snapshots.read('computer-1', '["replacement"]');
      yield* snapshots.write('computer-1', old);
      const afterOldWrite = records.has('computer-1');
      yield* snapshots.write(
        'computer-1',
        projectWorktreeSnapshot(inventory, '["replacement"]', 20),
      );
      yield* snapshots.remove('computer-1', '["original"]');
      yield* snapshots.remove('computer-1');
      const replacement = yield* snapshots.read(
        'computer-1',
        '["replacement"]',
      );
      yield* access.forget('computer-1');
      yield* snapshots.remove('computer-1');
      yield* snapshots.write(
        'computer-1',
        projectWorktreeSnapshot(inventory, '["replacement"]', 30),
      );
      const afterForget = records.has('computer-1');
      return {
        corrupt,
        afterCorrupt,
        previous,
        afterOldWrite,
        savedAt: replacement?.confirmedAt,
        afterForget,
      };
    }),
  );
  expect(result).toEqual({
    corrupt: undefined,
    afterCorrupt: false,
    previous: undefined,
    afterOldWrite: false,
    savedAt: 20,
    afterForget: false,
  });
});
