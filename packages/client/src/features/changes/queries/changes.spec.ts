import { editFile } from '@porcelain/client/files';
import { afterEach, expect, it } from 'vitest';
import { Effect, Option, Schema, Stream } from 'effect';
import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import {
  readChangeDiffs,
  readCommitDiffs,
  readChangeDiffWindow,
} from '@porcelain/client/changes';
import { AtomRegistry, AsyncResult, type Atom } from 'effect/reactivity';
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

const diffSelection = {
  scope: 'unstaged' as const,
  oldPath: 'README.md',
  newPath: 'README.md',
};
const diffInput = {
  expectedStatusToken: snapshot.statusToken,
  expectedFiles: [{ path: 'README.md', fingerprint: 'c'.repeat(64) }],
  selections: [diffSelection],
};
const diffSnapshot = {
  environmentId,
  worktreeId: scope.worktreeId,
  statusToken: snapshot.statusToken,
  diffs: [
    {
      selection: diffSelection,
      content: { kind: 'text', patch: 'Readme patch' },
    },
  ],
};

it.each([
  { environmentId: '5c9f2dc8-a554-45f1-aeab-0b22431137b4' },
  { worktreeId: '11111111111111111111111111111111' },
  { statusToken: 'b'.repeat(64) },
])(
  'rejects a diff window that belongs to another observation: %j',
  async (changed) => {
    const subject = fixture(() =>
      Promise.resolve(Response.json({ ...diffSnapshot, ...changed })),
    );
    await expect(
      Effect.runPromise(
        AtomRegistry.getResult(
          subject.registry,
          readChangeDiffs({
            connection: subject.connection,
            scope,
            input: diffInput,
          }),
        ),
      ),
    ).rejects.toThrow('The connected context changed.');
  },
);

it('isolates a commit comparison by parent and preserves its requested rename paths', async () => {
  const oid = 'a'.repeat(40);
  const sent: { path: string; body: string }[] = [];
  const subject = fixture(async (path, init) => {
    const body = await new Response(init?.body).text();
    sent.push({ path, body });
    return Response.json({
      commitOid: oid,
      diffs: [
        {
          paths: ['before.md', 'after.md'],
          content: {
            kind: 'text',
            patch: body.includes('"parent":2')
              ? 'Second parent'
              : 'First parent',
          },
        },
      ],
    });
  });
  const selection = {
    connection: subject.connection,
    scope,
    oid,
    paths: [['before.md', 'after.md']],
  };
  const first = await Effect.runPromise(
    AtomRegistry.getResult(
      subject.registry,
      readCommitDiffs({ ...selection, parent: 1 }),
    ),
  );
  const second = await Effect.runPromise(
    AtomRegistry.getResult(
      subject.registry,
      readCommitDiffs({ ...selection, parent: 2 }),
    ),
  );
  expect(first.diffs).toEqual([
    {
      paths: ['before.md', 'after.md'],
      content: { kind: 'text', patch: 'First parent' },
    },
  ]);
  expect(second.diffs).toEqual([
    {
      paths: ['before.md', 'after.md'],
      content: { kind: 'text', patch: 'Second parent' },
    },
  ]);
  expect(sent).toEqual([
    {
      path: `/api/worktrees/${scope.worktreeId}/commits/${oid}/diffs`,
      body: '{"paths":[["before.md","after.md"]]}',
    },
    {
      path: `/api/worktrees/${scope.worktreeId}/commits/${oid}/diffs`,
      body: '{"parent":2,"paths":[["before.md","after.md"]]}',
    },
  ]);
});

function windowInput() {
  const expectedFiles = Array.from(
    { length: DIFFS_PER_REQUEST + 1 },
    (_, index) => ({ path: `file-${index}.md`, fingerprint: 'c'.repeat(64) }),
  );
  return {
    scope,
    statusToken: snapshot.statusToken,
    expectedFiles,
    selections: expectedFiles.map(({ path }) => ({
      scope: 'unstaged' as const,
      oldPath: path,
      newPath: path,
    })),
  };
}

it('keeps a multi-request window incomplete until every batch succeeds and exposes a partial failure', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  let requests = 0;
  const subject = fixture(() => {
    if (++requests === 1) return held.promise;
    started.resolve();
    return Promise.resolve(
      Response.json({ message: 'Could not inspect Git' }, { status: 500 }),
    );
  });
  const input = windowInput();
  const window = readChangeDiffWindow({
    connection: subject.connection,
    ...input,
  });
  const failed = Promise.withResolvers<void>();
  const stop = subject.registry.subscribe(
    window,
    (value) => {
      if (AsyncResult.isFailure(value.result)) failed.resolve();
    },
    { immediate: true },
  );
  await started.promise;
  expect(AsyncResult.isInitial(subject.registry.get(window).result)).toBe(true);
  held.resolve(
    Response.json({
      ...diffSnapshot,
      diffs: input.selections.slice(0, DIFFS_PER_REQUEST).map((selection) => ({
        selection,
        content: { kind: 'text', patch: 'First batch' },
      })),
    }),
  );
  await failed.promise;
  const result = subject.registry.get(window).result;
  expect(AsyncResult.isFailure(result)).toBe(true);
  expect(Option.isNone(AsyncResult.value(result))).toBe(true);
  expect(requests).toBe(2);
  stop();
});

it('retains the entire confirmed diff window when one refreshed batch fails', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  let refreshing = false;
  const payload = Schema.fromJsonString(
    Schema.Struct({
      selections: Schema.Array(
        Schema.Struct({
          scope: Schema.Literals(['staged', 'unstaged']),
          oldPath: Schema.String,
          newPath: Schema.String,
        }),
      ),
    }),
  );
  const subject = fixture((_, init) => {
    const bytes = init?.body;
    if (!(bytes instanceof Uint8Array))
      throw new Error('Expected request bytes');
    const { selections } = Schema.decodeUnknownSync(payload)(
      new TextDecoder().decode(bytes),
    );
    const suffix = selections.length === 1;
    if (refreshing && suffix) {
      started.resolve();
      return held.promise;
    }
    return Promise.resolve(
      Response.json({
        ...diffSnapshot,
        diffs: selections.map((selection) => ({
          selection,
          content: {
            kind: 'text',
            patch: refreshing
              ? 'New prefix'
              : suffix
                ? 'Confirmed suffix'
                : 'Confirmed prefix',
          },
        })),
      }),
    );
  });
  const window = readChangeDiffWindow({
    connection: subject.connection,
    ...windowInput(),
  });
  const stop = subject.registry.mount(window);
  const observe = (
    predicate: (result: Atom.Type<typeof window>['result']) => boolean,
  ) =>
    Effect.runPromise(
      AtomRegistry.toStream(subject.registry, window).pipe(
        Stream.map((value) => value.result),
        Stream.filter(predicate),
        Stream.take(1),
        Stream.runHead,
      ),
    );
  try {
    const complete = Option.getOrThrow(
      await observe(
        (result) => AsyncResult.isSuccess(result) && !result.waiting,
      ),
    );
    const expected = [
      ...Array.from({ length: DIFFS_PER_REQUEST }, () => ({
        kind: 'text',
        patch: 'Confirmed prefix',
      })),
      { kind: 'text', patch: 'Confirmed suffix' },
    ];
    expect([
      ...Option.getOrThrow(AsyncResult.value(complete)).values(),
    ]).toEqual(expected);
    refreshing = true;
    const failed = observe(AsyncResult.isFailure);
    subject.registry.refresh(window);
    await started.promise;
    expect([
      ...Option.getOrThrow(
        AsyncResult.value(subject.registry.get(window).result),
      ).values(),
    ]).toEqual(expected);
    held.resolve(
      Response.json({ message: 'Git inspection unavailable' }, { status: 503 }),
    );
    const result = Option.getOrThrow(await failed);
    expect(AsyncResult.isFailure(result)).toBe(true);
    expect([...Option.getOrThrow(AsyncResult.value(result)).values()]).toEqual(
      expected,
    );
  } finally {
    held.resolve(
      Response.json({ message: 'Git inspection unavailable' }, { status: 503 }),
    );
    stop();
  }
});

it('unmounting a diff window cancels each in-flight batch without disconnecting its environment', async () => {
  const started = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  let requests = 0;
  let cancellations = 0;
  const subject = fixture((_, init) => {
    const held = Promise.withResolvers<Response>();
    init?.signal?.addEventListener(
      'abort',
      () => {
        if (++cancellations === 2) aborted.resolve();
        held.resolve(Response.json(diffSnapshot));
      },
      { once: true },
    );
    if (++requests === 2) started.resolve();
    return held.promise;
  });
  const stop = subject.registry.mount(
    readChangeDiffWindow({ connection: subject.connection, ...windowInput() }),
  );
  await started.promise;
  stop();
  await aborted.promise;
  expect(cancellations).toBe(2);
  expect(subject.controller.signal.aborted).toBe(false);
});

it('a failed stale-diff recovery finishes once per observation and remains independent across connections', async () => {
  const recoveries = [0, 0];
  const settleRecovery = async (index: number) => {
    const recovered = Promise.withResolvers<void>();
    const pendingReached = Promise.withResolvers<void>();
    const inspection = Promise.withResolvers<Response>();
    const subject = fixture((path) => {
      if (path.endsWith('/diffs'))
        return Promise.resolve(
          Response.json(
            {
              statusCode: 409,
              error: 'Conflict',
              message: 'Refresh status and retry inspection',
              code: 'worktree_changed',
            },
            { status: 409 },
          ),
        );
      recoveries[index] = (recoveries[index] ?? 0) + 1;
      return inspection.promise;
    });
    const window = readChangeDiffWindow({
      connection: subject.connection,
      scope,
      statusToken: snapshot.statusToken,
      expectedFiles: diffInput.expectedFiles,
      selections: diffInput.selections,
    });
    let sawPending = false;
    const stop = subject.registry.subscribe(
      window,
      ({ recovery }) => {
        const pending = Option.exists(
          AsyncResult.value(recovery),
          (state) => state.pending,
        );
        if (pending) {
          sawPending = true;
          pendingReached.resolve();
        }
        if (sawPending && !pending) recovered.resolve();
      },
      { immediate: true },
    );
    await pendingReached.promise;
    inspection.resolve(
      Response.json({ message: 'Could not inspect Git' }, { status: 500 }),
    );
    await recovered.promise;
    subject.registry.refresh(window);
    const answer = await Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readChangeDiffs({
          connection: subject.connection,
          scope,
          input: diffInput,
        }),
        { suspendOnWaiting: true },
      ).pipe(Effect.exit),
    );
    const pending = Option.getOrThrow(
      AsyncResult.value(subject.registry.get(window).recovery),
    ).pending;
    stop();
    return { outcome: answer._tag, pending };
  };
  const first = await settleRecovery(0);
  const replacement = await settleRecovery(1);
  expect(first).toEqual({ outcome: 'Failure', pending: false });
  expect(replacement).toEqual({ outcome: 'Failure', pending: false });
  expect(recoveries).toEqual([1, 1]);
});

it('a file edit refreshes the current Changes snapshot without rereading a diff tied to its old observation', async () => {
  let changed = false;
  let diffReads = 0;
  const reread = Promise.withResolvers<void>();
  const subject = fixture((path, init) => {
    if (path.endsWith('/files') && init?.method === 'POST') {
      changed = true;
      return Promise.resolve(Response.json({ path: 'README.md' }));
    }
    if (path.endsWith('/changes/diffs')) {
      diffReads++;
      return Promise.resolve(Response.json(diffSnapshot));
    }
    if (changed) reread.resolve();
    return Promise.resolve(
      Response.json(
        changed ? { ...snapshot, statusToken: 'b'.repeat(64) } : snapshot,
      ),
    );
  });
  const selection = { connection: subject.connection, scope };
  const changes = readChanges(selection);
  const diff = readChangeDiffs({ ...selection, input: diffInput });
  const stopChanges = subject.registry.mount(changes);
  const stopDiff = subject.registry.mount(diff);
  await Effect.runPromise(AtomRegistry.getResult(subject.registry, changes));
  await Effect.runPromise(AtomRegistry.getResult(subject.registry, diff));
  const edit = editFile(selection);
  subject.registry.set(edit, {
    kind: 'write',
    path: 'README.md',
    text: 'Updated',
    expectedFingerprint: 'c'.repeat(64),
  });
  await Effect.runPromise(
    AtomRegistry.getResult(subject.registry, edit, { suspendOnWaiting: true }),
  );
  await reread.promise;
  expect(
    (
      await Effect.runPromise(
        AtomRegistry.getResult(subject.registry, changes, {
          suspendOnWaiting: true,
        }),
      )
    ).statusToken,
  ).toBe('b'.repeat(64));
  expect(diffReads).toBe(1);
  stopChanges();
  stopDiff();
});
