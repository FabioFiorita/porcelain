import { afterEach, expect, it } from 'vitest';
import { Effect, Option } from 'effect';
import { AtomRegistry, AsyncResult } from 'effect/reactivity';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { readChanges, readGitStatus } from './changes.ts';
import { readCurrentChanges, refreshGitLook } from '@porcelain/client/changes';

const environmentId = '37e09b06-b70c-49a7-9b77-b85f87fe25e8';
const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const snapshot = {
  environmentId,
  worktreeId: scope.worktreeId,
  statusToken: 'a'.repeat(64),
  headOid: null,
  inProgress: null,
  mergeHeadOid: null,
  branch: null,
  changes: [],
};
const owned: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of owned) await close();
  owned.length = 0;
});
function fixture(transport: Transport) {
  const lifetime = createWorktreeConnection({
    environmentId,
    transport,
    timeoutMs: 10_000,
  });
  const registry = AtomRegistry.make();
  owned.push(async () => {
    registry.dispose();
    await lifetime.close();
  });
  return { ...lifetime, registry };
}

it.each([
  { environmentId: '5c9f2dc8-a554-45f1-aeab-0b22431137b4' },
  { worktreeId: '11111111111111111111111111111111' },
])(
  'rejects a Changes snapshot from a different connected scope: %j',
  async (changed) => {
    const subject = fixture(() =>
      Promise.resolve(Response.json({ ...snapshot, ...changed })),
    );
    await expect(
      Effect.runPromise(
        AtomRegistry.getResult(
          subject.registry,
          readChanges({ connection: subject.connection, scope }),
        ),
      ),
    ).rejects.toThrow('The connected context changed.');
  },
);

it('a fresh inspection waits for a new snapshot instead of returning the mounted prior read', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  let requests = 0;
  const subject = fixture(() => {
    requests++;
    if (requests === 1) return Promise.resolve(Response.json(snapshot));
    started.resolve();
    return held.promise;
  });
  const selection = { connection: subject.connection, scope };
  const state = readChanges(selection);
  const stop = subject.registry.mount(state);
  await Effect.runPromise(AtomRegistry.getResult(subject.registry, state));
  const command = readCurrentChanges(selection);
  subject.registry.set(command, undefined);
  const answer = Effect.runPromise(
    AtomRegistry.getResult(subject.registry, command, {
      suspendOnWaiting: true,
    }),
  );
  await started.promise;
  expect(requests).toBe(2);
  expect(
    Option.getOrThrow(AsyncResult.value(subject.registry.get(state)))
      .statusToken,
  ).toBe('a'.repeat(64));
  held.resolve(Response.json({ ...snapshot, statusToken: 'b'.repeat(64) }));
  expect((await answer).statusToken).toBe('b'.repeat(64));
  stop();
});

it('a failed fresh inspection rejects even when an older snapshot remains visible', async () => {
  let requests = 0;
  const subject = fixture(() =>
    Promise.resolve(
      ++requests === 1
        ? Response.json(snapshot)
        : Response.json({ message: 'Could not inspect Git' }, { status: 500 }),
    ),
  );
  const selection = { connection: subject.connection, scope };
  const state = readChanges(selection);
  const stop = subject.registry.mount(state);
  await Effect.runPromise(AtomRegistry.getResult(subject.registry, state));
  const command = readCurrentChanges(selection);
  subject.registry.set(command, undefined);
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(subject.registry, command, {
        suspendOnWaiting: true,
      }),
    ),
  ).rejects.toMatchObject({ _tag: 'RequestError', status: 500 });
  expect(AsyncResult.isSuccess(subject.registry.get(state))).toBe(true);
  expect(
    Option.getOrThrow(AsyncResult.value(subject.registry.get(state)))
      .statusToken,
  ).toBe('a'.repeat(64));
  stop();
});

it('looking again refreshes Changes and invalidates the mounted detailed Git status', async () => {
  let gitReads = 0;
  const reread = Promise.withResolvers<void>();
  const subject = fixture((path) => {
    if (path.endsWith('/git/status')) {
      gitReads++;
      if (gitReads === 2) reread.resolve();
      return Promise.resolve(
        Response.json({
          ...snapshot,
          branch: undefined,
          consistency: 'best-effort',
          headCommit: null,
        }),
      );
    }
    return Promise.resolve(Response.json(snapshot));
  });
  const selection = { connection: subject.connection, scope };
  const status = readGitStatus(selection);
  const stop = subject.registry.mount(status);
  await Effect.runPromise(AtomRegistry.getResult(subject.registry, status));
  const command = refreshGitLook(selection);
  subject.registry.set(command, undefined);
  expect(
    (
      await Effect.runPromise(
        AtomRegistry.getResult(subject.registry, command, {
          suspendOnWaiting: true,
        }),
      )
    ).statusToken,
  ).toBe('a'.repeat(64));
  await reread.promise;
  await Effect.runPromise(
    AtomRegistry.getResult(subject.registry, status, {
      suspendOnWaiting: true,
    }),
  );
  expect(gitReads).toBe(2);
  stop();
});
