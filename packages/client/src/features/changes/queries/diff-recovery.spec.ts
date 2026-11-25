import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { expect, it } from 'vite-plus/test';
import { Option, Schema } from 'effect';
import { AsyncResult, type Atom } from 'effect/reactivity';
import { readChangeDiffWindow } from '@porcelain/client/changes';
import { readChanges } from './changes.ts';

const environmentId = '37e09b06-b70c-49a7-9b77-b85f87fe25e8';
const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const token = (letter: string) => letter.repeat(64);
const fixture = clientFixtures(environmentId);
const CHANGES_LIMIT = 24;
const DIFFS_LIMIT = 64;
const WRITES_LIMIT = 500;
const settled = { timeout: 2_000 };

const decodeRequest = Schema.decodeUnknownSync(
  Schema.Struct({
    expectedStatusToken: Schema.String,
    expectedFiles: Schema.Array(
      Schema.Struct({ path: Schema.String, fingerprint: Schema.String }),
    ),
    selections: Schema.Array(
      Schema.Struct({
        scope: Schema.Literal('unstaged'),
        oldPath: Schema.String,
        newPath: Schema.String,
      }),
    ),
  }),
);
type DiffRequest = ReturnType<typeof decodeRequest>;
type Snapshot = { statusToken: string; fingerprint?: string };
type Answer = 'stale' | 'ok';

function bodyText(body: RequestInit['body']) {
  if (typeof body === 'string') return body;
  return body instanceof Uint8Array ? new TextDecoder().decode(body) : '';
}

function fileChange(path: string, fingerprint: string) {
  return {
    path,
    fingerprint: fingerprint.repeat(64),
    comparisons: [
      {
        scope: 'unstaged',
        kind: 'modified',
        oldPath: path,
        newPath: path,
        oldMode: '100644',
        newMode: '100644',
        oldOid: null,
        newOid: null,
        supported: true,
      },
    ],
  };
}

function staleAnswer() {
  return Response.json(
    {
      statusCode: 409,
      error: 'Conflict',
      message: 'Refresh status and retry inspection',
      code: 'worktree_changed',
    },
    { status: 409 },
  );
}

function diffAnswer(request: DiffRequest) {
  return Response.json({
    environmentId,
    worktreeId: scope.worktreeId,
    statusToken: request.expectedStatusToken,
    diffs: request.selections.map((selection) => ({
      selection,
      content: { kind: 'text', patch: `${selection.newPath} patch` },
    })),
  });
}

function worktree(script: {
  paths?: readonly string[];
  changes: (
    read: number,
  ) => Snapshot | 'unavailable' | Promise<Snapshot | 'unavailable'>;
  diff: (request: DiffRequest, attempt: number) => Answer | Promise<Answer>;
}) {
  const counts = { changes: 0, diffs: 0 };
  const log: string[] = [];
  const listed = script.paths ?? ['README.md'];
  const attempts = new Map<string, number>();
  const stops = new Set<() => void>();
  const stopAll = () => {
    for (const stop of stops) stop();
    stops.clear();
  };
  const subject = fixture((path, init) => {
    if (path.endsWith('/changes/diffs')) {
      counts.diffs += 1;
      if (counts.diffs > DIFFS_LIMIT) return new Promise<Response>(() => {});
      const key = bodyText(init?.body);
      const request = decodeRequest(JSON.parse(key));
      const attempt = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, attempt);
      log.push(`diffs ${request.expectedFiles[0]?.path ?? ''}`);
      return Promise.resolve(script.diff(request, attempt)).then((answer) =>
        answer === 'stale' ? staleAnswer() : diffAnswer(request),
      );
    }
    counts.changes += 1;
    if (counts.changes > CHANGES_LIMIT) {
      stopAll();
      return new Promise<Response>(() => {});
    }
    log.push(`changes ${counts.changes}`);
    return Promise.resolve(script.changes(counts.changes)).then((snapshot) =>
      snapshot === 'unavailable'
        ? Response.json(
            {
              statusCode: 500,
              error: 'Internal Server Error',
              message: 'Changes could not be read',
            },
            { status: 500 },
          )
        : Response.json({
            environmentId,
            worktreeId: scope.worktreeId,
            headOid: null,
            inProgress: null,
            mergeHeadOid: null,
            branch: null,
            statusToken: snapshot.statusToken,
            changes: listed.map((path) =>
              fileChange(path, snapshot.fingerprint ?? 'c'),
            ),
          }),
    );
  });
  let writes = 0;
  let runaway = false;
  const write = subject.registry.set.bind(subject.registry);
  Object.assign(subject.registry, {
    set: <R, W>(atom: Atom.Writable<R, W>, value: W) => {
      writes += 1;
      if (writes > WRITES_LIMIT && !runaway) {
        runaway = true;
        stopAll();
      }
      if (!runaway) write(atom, value);
    },
  });
  const files = (paths: readonly string[], fingerprint = 'c') => ({
    expectedFiles: paths.map((path) => ({
      path,
      fingerprint: fingerprint.repeat(64),
    })),
    selections: paths.map((path) => ({
      scope: 'unstaged' as const,
      oldPath: path,
      newPath: path,
    })),
  });
  const mount = (input: {
    statusToken: string;
    read: number;
    paths: readonly string[];
    fingerprint?: string;
  }) => {
    const window = readChangeDiffWindow({
      connection: subject.connection,
      scope,
      statusToken: input.statusToken,
      read: input.read,
      ...files(input.paths, input.fingerprint),
    });
    const seen: { loaded: boolean; failed: boolean; pending: boolean }[] = [];
    const stop = subject.registry.subscribe(
      window,
      ({ result, recovery }) => {
        seen.push({
          loaded: AsyncResult.isSuccess(result),
          failed: AsyncResult.isFailure(result),
          pending: recovery.pending,
        });
      },
      { immediate: true },
    );
    stops.add(stop);
    return {
      latest: () => seen.at(-1),
      seen,
      stop: () => {
        stop();
        stops.delete(stop);
      },
    };
  };
  const changes = readChanges({ connection: subject.connection, scope });
  const follow = (
    paths: readonly string[],
    fingerprintAt: (read: number) => string = () => 'c',
  ) => {
    let current: ReturnType<typeof mount> | undefined;
    let following: number | undefined;
    let answered: unknown;
    const stopChanges = subject.registry.subscribe(
      changes,
      (result) => {
        const answer = Option.getOrUndefined(AsyncResult.value(result));
        if (!answer || answer === answered) return;
        answered = answer;
        following = answer.read;
        current?.stop();
        current = mount({
          statusToken: answer.statusToken,
          read: answer.read,
          paths,
          fingerprint: fingerprintAt(answer.read),
        });
      },
      { immediate: true },
    );
    stops.add(stopChanges);
    return {
      window: () => current,
      read: () => following,
      loadsAt: (read: number) =>
        expect
          .poll(() => [following, current?.latest()?.loaded], settled)
          .toEqual([read, true]),
    };
  };
  const takeReads = async (count: number) => {
    stops.add(subject.registry.mount(changes));
    for (let read = 1; read <= count; read += 1) {
      if (read > 1) subject.registry.refresh(changes);
      await expect.poll(() => counts.changes).toBe(read);
    }
  };
  return {
    counts,
    log,
    runaway: () => runaway,
    mount,
    follow,
    takeReads,
    readAgain: () => subject.registry.refresh(changes),
    stopAll,
  };
}

async function staleOnceAfterOneRead(paths: readonly string[]) {
  const server = worktree({
    paths,
    changes: () => ({ statusToken: token('a') }),
    diff: (_, attempt) => (attempt === 1 ? 'stale' : 'ok'),
  });
  await server.takeReads(1);
  return server;
}

it('two windows at different reads that both fail stale recover with one shared refresh and no superseded replay', async () => {
  const tokens = ['a', 'b', 'b'];
  const server = worktree({
    changes: (read) => ({ statusToken: token(tokens[read - 1] ?? 'b') }),
    diff: (request, attempt) =>
      request.expectedStatusToken === token('a') || attempt === 1
        ? 'stale'
        : 'ok',
  });
  await server.takeReads(2);
  const older = server.mount({
    statusToken: token('a'),
    read: 1,
    paths: ['README.md'],
  });
  const newer = server.mount({
    statusToken: token('b'),
    read: 2,
    paths: ['README.md'],
  });
  await expect
    .poll(() => [older.latest()?.pending, newer.latest()?.loaded], settled)
    .toEqual([true, true]);
  const current = server.mount({
    statusToken: token('b'),
    read: 3,
    paths: ['README.md'],
  });
  expect(current.latest()?.loaded).toBe(true);
  expect(server.counts).toEqual({ changes: 3, diffs: 3 });
  expect(older.seen.some((state) => state.failed && !state.pending)).toBe(
    false,
  );
  expect(server.runaway()).toBe(false);
});

it('a window still on the snapshot before an edit waits for the edited one instead of resending its request', async () => {
  const before = 'c'.repeat(64);
  const server = worktree({
    changes: (read) => ({
      statusToken: token('a'),
      fingerprint: read === 1 ? 'c' : 'd',
    }),
    diff: (request) =>
      request.expectedFiles[0]?.fingerprint === before ? 'stale' : 'ok',
  });
  await server.takeReads(1);
  const held = server.mount({
    statusToken: token('a'),
    read: 1,
    paths: ['README.md'],
  });
  const view = server.follow(['README.md'], (read) => (read === 1 ? 'c' : 'd'));
  await view.loadsAt(2);
  server.readAgain();
  await view.loadsAt(3);
  expect(server.counts).toEqual({ changes: 3, diffs: 2 });
  expect(held.latest()).toEqual({
    loaded: false,
    failed: false,
    pending: true,
  });
  expect(server.runaway()).toBe(false);
});

it('a status token that comes back with the same files after another read still recovers', async () => {
  const tokens = ['a', 'b', 'a', 'a'];
  const server = worktree({
    changes: (read) => ({ statusToken: token(tokens[read - 1] ?? 'a') }),
    diff: (request, attempt) =>
      request.expectedStatusToken === token('a') && attempt <= 2
        ? 'stale'
        : 'ok',
  });
  const view = server.follow(['README.md']);
  await view.loadsAt(2);
  server.readAgain();
  await view.loadsAt(4);
  expect(server.counts).toEqual({ changes: 4, diffs: 4 });
  expect(server.runaway()).toBe(false);
});

it('stage, unstage, then an edit read under the first token still recovers its stale diff', async () => {
  const steps = [
    { letter: 'a', fingerprint: 'c' },
    { letter: 'a', fingerprint: 'c' },
    { letter: 'b', fingerprint: 'c' },
    { letter: 'a', fingerprint: 'c' },
    { letter: 'a', fingerprint: 'd' },
    { letter: 'a', fingerprint: 'd' },
  ];
  const server = worktree({
    changes: (read) => ({
      statusToken: token(steps[read - 1]?.letter ?? 'a'),
      fingerprint: steps[read - 1]?.fingerprint ?? 'd',
    }),
    diff: (request, attempt) =>
      request.expectedStatusToken === token('a') && attempt === 1
        ? 'stale'
        : 'ok',
  });
  const view = server.follow(
    ['README.md'],
    (read) => steps[read - 1]?.fingerprint ?? 'd',
  );
  await view.loadsAt(2);
  server.readAgain();
  await view.loadsAt(3);
  server.readAgain();
  await view.loadsAt(4);
  server.readAgain();
  await view.loadsAt(6);
  expect(server.counts).toEqual({ changes: 6, diffs: 6 });
  expect(server.runaway()).toBe(false);
});

it('many windows of one stale read share a single Changes refresh, and each retries its own diff', async () => {
  const paths = Array.from({ length: 17 }, (_, index) => `file-${index}.md`);
  const server = await staleOnceAfterOneRead(paths);
  const windows = paths.map((path) =>
    server.mount({ statusToken: token('a'), read: 1, paths: [path] }),
  );
  await expect
    .poll(() => windows.every((window) => window.latest()?.loaded), settled)
    .toBe(true);
  expect(server.counts).toEqual({ changes: 2, diffs: 34 });
  expect(server.runaway()).toBe(false);
});

it('windows reading different files of one snapshot share a single refresh', async () => {
  const server = await staleOnceAfterOneRead(['a.md', 'b.md']);
  const one = server.mount({
    statusToken: token('a'),
    read: 1,
    paths: ['a.md'],
  });
  const two = server.mount({
    statusToken: token('a'),
    read: 1,
    paths: ['a.md', 'b.md'],
  });
  await expect
    .poll(() => [one.latest()?.loaded, two.latest()?.loaded], settled)
    .toEqual([true, true]);
  expect(server.counts).toEqual({ changes: 2, diffs: 4 });
  expect(server.runaway()).toBe(false);
});

it('a refresh that returns identical contents retries the failed diff once, which loads with no further refresh', async () => {
  const server = worktree({
    changes: () => ({ statusToken: token('a') }),
    diff: (_, attempt) => (attempt === 1 ? 'stale' : 'ok'),
  });
  const view = server.follow(['README.md']);
  await expect.poll(() => view.window()?.latest()?.loaded, settled).toBe(true);
  expect(server.counts).toEqual({ changes: 2, diffs: 2 });
  expect(server.runaway()).toBe(false);
});

it('an unrelated Changes read with identical contents keeps the confirmed diff visible', async () => {
  const server = worktree({
    changes: () => ({ statusToken: token('a') }),
    diff: () => 'ok',
  });
  const view = server.follow(['README.md']);
  await expect.poll(() => view.window()?.latest()?.loaded, settled).toBe(true);
  server.readAgain();
  await expect.poll(() => view.read(), settled).toBe(2);
  expect(view.window()?.seen.every((state) => state.loaded)).toBe(true);
  expect(server.counts).toEqual({ changes: 2, diffs: 1 });
  expect(server.runaway()).toBe(false);
});

it('a file that changes during every inspection retries once, settles on a failure, and a later read can try again', async () => {
  const server = worktree({
    changes: (read) => ({ statusToken: token(String.fromCharCode(96 + read)) }),
    diff: () => 'stale',
  });
  const view = server.follow(['README.md']);
  await expect
    .poll(() => {
      const latest = view.window()?.latest();
      return [view.read(), latest?.failed, latest?.pending];
    }, settled)
    .toEqual([2, true, false]);
  expect(server.counts).toEqual({ changes: 2, diffs: 3 });
  server.readAgain();
  await expect
    .poll(() => {
      const latest = view.window()?.latest();
      return [view.read(), latest?.failed, latest?.pending];
    }, settled)
    .toEqual([4, true, false]);
  expect(server.counts).toEqual({ changes: 4, diffs: 6 });
  expect(server.runaway()).toBe(false);
});

it('a window with no diff to read never shows as pending during another window’s recovery', async () => {
  const server = worktree({
    changes: () => ({ statusToken: token('a') }),
    diff: () => 'stale',
  });
  await server.takeReads(1);
  const empty = server.mount({ statusToken: token('a'), read: 1, paths: [] });
  const stale = server.mount({
    statusToken: token('a'),
    read: 1,
    paths: ['README.md'],
  });
  await expect
    .poll(() => stale.seen.some((state) => state.pending), settled)
    .toBe(true);
  expect(empty.seen.some((state) => state.pending)).toBe(false);
});

it('a slow automatic retry keeps the window pending until the server answers', async () => {
  const retried = Promise.withResolvers<Answer>();
  const server = worktree({
    changes: () => ({ statusToken: token('a') }),
    diff: (_, attempt) => (attempt === 1 ? 'stale' : retried.promise),
  });
  await server.takeReads(1);
  const window = server.mount({
    statusToken: token('a'),
    read: 1,
    paths: ['README.md'],
  });
  const settledOnFailure = () =>
    window.seen.some((state) => state.failed && !state.pending);
  await expect
    .poll(() => server.counts, settled)
    .toEqual({ changes: 2, diffs: 2 });
  expect(settledOnFailure()).toBe(false);
  retried.resolve('ok');
  await expect.poll(() => window.latest()?.loaded, settled).toBe(true);
  expect(settledOnFailure()).toBe(false);
  expect(server.runaway()).toBe(false);
});

it('a recovery resends only the stale batch of a window, and only after its refresh answers', async () => {
  const paths = Array.from(
    { length: 201 },
    (_, index) => `f-${String(index).padStart(3, '0')}.md`,
  );
  const refresh = Promise.withResolvers<Snapshot>();
  const server = worktree({
    paths,
    changes: (read) =>
      read === 2 ? refresh.promise : { statusToken: token('a') },
    diff: (request, attempt) =>
      request.expectedFiles.some((file) => file.path === 'f-200.md') &&
      attempt === 1
        ? 'stale'
        : 'ok',
  });
  await server.takeReads(1);
  const window = server.mount({ statusToken: token('a'), read: 1, paths });
  await expect.poll(() => server.counts.changes, settled).toBe(2);
  server.log.push('released');
  refresh.resolve({ statusToken: token('a') });
  await expect.poll(() => window.latest()?.loaded, settled).toBe(true);
  expect(server.log).toEqual([
    'changes 1',
    'diffs f-000.md',
    'diffs f-200.md',
    'changes 2',
    'released',
    'diffs f-200.md',
  ]);
  expect(server.runaway()).toBe(false);
});

it('a recovery whose Changes refresh fails settles the window on its failure without resending the diff', async () => {
  const server = worktree({
    changes: (read) =>
      read === 1 ? { statusToken: token('a') } : 'unavailable',
    diff: (_, attempt) => (attempt === 1 ? 'stale' : 'ok'),
  });
  await server.takeReads(1);
  const window = server.mount({
    statusToken: token('a'),
    read: 1,
    paths: ['README.md'],
  });
  await expect
    .poll(() => window.latest(), settled)
    .toEqual({ loaded: false, failed: true, pending: false });
  expect(server.counts).toEqual({ changes: 2, diffs: 1 });
  expect(server.runaway()).toBe(false);
});

it('a window reports no failed result while its automatic recovery is pending', async () => {
  const server = await staleOnceAfterOneRead(['README.md']);
  const window = server.mount({
    statusToken: token('a'),
    read: 1,
    paths: ['README.md'],
  });
  await expect.poll(() => window.latest()?.loaded, settled).toBe(true);
  expect(window.seen.some((state) => state.pending)).toBe(true);
  expect(window.seen.filter((state) => state.failed)).toEqual([]);
  expect(server.runaway()).toBe(false);
});
