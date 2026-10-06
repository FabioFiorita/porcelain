import { afterEach, expect, it } from 'vitest';
import { Effect, Option, Stream, Schema } from 'effect';
import { AtomRegistry, AsyncResult, type Atom } from 'effect/reactivity';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { readReviewedFiles } from '@porcelain/client/reviews';
import type { ReviewRange } from '@porcelain/client/reviews/rules';
import { reviewedCommands } from './reviewed.ts';

const scope = { projectId: 'project', worktreeId: '0'.repeat(32) };
const fingerprint = 'a'.repeat(64);
const kept = {
  path: 'kept.md',
  fingerprint,
  reviewedAt: '2026-10-03T10:00:00.000Z',
};
const confirmed = { worktreeId: scope.worktreeId, marks: [kept] };
const owned: {
  close: () => Promise<void>;
  registry: AtomRegistry.AtomRegistry;
}[] = [];
function fixture(
  transport: Transport,
  range: ReviewRange = { kind: 'worktree' },
) {
  const lifetime = createWorktreeConnection({
    environmentId: 'environment',
    timeoutMs: 10_000,
    transport,
  });
  const registry = AtomRegistry.make();
  owned.push({ close: lifetime.close, registry });
  return {
    ...lifetime,
    registry,
    state: readReviewedFiles({ scope, connection: lifetime.connection, range }),
    commands: reviewedCommands({
      scope,
      connection: lifetime.connection,
      range,
    }),
  };
}
function read<A, E>(
  subject: { registry: AtomRegistry.AtomRegistry },
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
  return Effect.runPromise(
    AtomRegistry.getResult(subject.registry, atom, { suspendOnWaiting: true }),
  );
}
function execute<Input, A, E>(
  subject: { registry: AtomRegistry.AtomRegistry },
  command: Atom.AtomResultFn<Input, A, E>,
  input: Input,
) {
  subject.registry.set(command, input);
  return read(subject, command);
}
function shown(subject: ReturnType<typeof fixture>, paths: readonly string[]) {
  return Effect.runPromise(
    AtomRegistry.toStream(subject.registry, subject.state).pipe(
      Stream.filter(
        (result) =>
          JSON.stringify(
            Option.getOrUndefined(AsyncResult.value(result))?.marks.map(
              (mark) => mark.path,
            ),
          ) === JSON.stringify(paths),
      ),
      Stream.take(1),
      Stream.runHead,
    ),
  );
}
afterEach(async () => {
  for (const subject of owned) {
    subject.registry.dispose();
    await subject.close();
  }
  owned.length = 0;
});

it('shows both queued intents immediately, then rolls both back after the first fails without sending the dependent mark', async () => {
  const held = Promise.withResolvers<Response>();
  const writes: string[] = [];
  const subject = fixture((path, init) => {
    if (init?.method === 'PUT') {
      writes.push(path);
      return held.promise;
    }
    return Promise.resolve(Response.json(confirmed));
  });
  const stop = subject.registry.mount(subject.state);
  try {
    expect(await read(subject, subject.state)).toEqual(confirmed);
    const first = execute(subject, subject.commands.set, {
      path: 'first.md',
      fingerprint,
    });
    const second = execute(subject, subject.commands.set, {
      path: 'second.md',
      fingerprint,
    });
    const completed = Promise.allSettled([first, second]);
    expect(
      Option.getOrThrow(
        await shown(subject, ['kept.md', 'first.md', 'second.md']),
      )._tag,
    ).toBe('Success');
    const rolledBack = shown(subject, ['kept.md']);
    held.resolve(
      Response.json(
        { statusCode: 409, error: 'Conflict', message: 'File changed' },
        { status: 409 },
      ),
    );
    expect((await completed).map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(
      Option.getOrThrow(AsyncResult.value(Option.getOrThrow(await rolledBack))),
    ).toEqual(confirmed);
    expect(writes).toEqual([`/api/worktrees/${scope.worktreeId}/reviewed`]);
  } finally {
    held.resolve(Response.json(confirmed));
    stop();
  }
});

it('rebases the remaining optimistic mark over a partial-conflict reply instead of retaining a refused mark', async () => {
  const firstReply = Promise.withResolvers<Response>();
  const secondReply = Promise.withResolvers<Response>();
  const subject = fixture((path, init) => {
    if (path.endsWith('/reviewed-bulk')) return firstReply.promise;
    if (init?.method === 'PUT') return secondReply.promise;
    return Promise.resolve(Response.json(confirmed));
  });
  const stop = subject.registry.mount(subject.state);
  try {
    await read(subject, subject.state);
    const bulk = execute(subject, subject.commands.bulk, {
      kind: 'mark',
      entries: [{ path: 'first.md', fingerprint, reviewStatus: 'unreviewed' }],
    });
    const second = execute(subject, subject.commands.set, {
      path: 'second.md',
      fingerprint,
    });
    const completed = Promise.allSettled([bulk, second]);
    await shown(subject, ['kept.md', 'first.md', 'second.md']);
    const rebased = shown(subject, ['kept.md', 'second.md']);
    firstReply.resolve(
      Response.json({
        ...confirmed,
        marked: [],
        conflicts: [{ path: 'first.md', reason: 'stale' }],
      }),
    );
    expect(await bulk).toMatchObject({
      kind: 'mark',
      report: { marked: [], failed: [{ path: 'first.md' }] },
    });
    expect(
      Option.getOrThrow(
        AsyncResult.value(Option.getOrThrow(await rebased)),
      ).marks.map((mark) => mark.path),
    ).toEqual(['kept.md', 'second.md']);
    const saved = {
      worktreeId: scope.worktreeId,
      marks: [
        kept,
        {
          path: 'second.md',
          fingerprint,
          reviewedAt: '2026-10-06T04:00:00.000Z',
        },
      ],
    };
    secondReply.resolve(Response.json(saved));
    expect(await second).toEqual(saved);
    expect((await completed).map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ]);
  } finally {
    firstReply.resolve(
      Response.json({ ...confirmed, marked: [], conflicts: [] }),
    );
    secondReply.resolve(Response.json(confirmed));
    stop();
  }
});

it('refuses a write completed after disconnect and never publishes its mark', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const subject = fixture((_, init) => {
    if (init?.method === 'PUT') {
      started.resolve();
      return held.promise;
    }
    return Promise.resolve(Response.json(confirmed));
  });
  const stop = subject.registry.mount(subject.state);
  try {
    await read(subject, subject.state);
    subject.registry.set(subject.commands.set, {
      path: 'late.md',
      fingerprint,
    });
    const completed = Effect.runPromiseExit(
      AtomRegistry.getResult(subject.registry, subject.commands.set, {
        suspendOnWaiting: true,
      }),
    );
    await started.promise;
    await shown(subject, ['kept.md', 'late.md']);
    const rolledBack = shown(subject, ['kept.md']);
    subject.controller.abort();
    held.resolve(
      Response.json({
        worktreeId: scope.worktreeId,
        marks: [
          kept,
          {
            path: 'late.md',
            fingerprint,
            reviewedAt: '2026-10-06T04:00:00.000Z',
          },
        ],
      }),
    );
    expect((await completed)._tag).toBe('Failure');
    expect(
      Option.getOrThrow(AsyncResult.value(Option.getOrThrow(await rolledBack))),
    ).toEqual(confirmed);
  } finally {
    held.resolve(Response.json(confirmed));
    stop();
  }
});

function bulkFixture(
  answer: (
    files: readonly { path: string; fingerprint: string }[],
    number: number,
  ) => Response,
) {
  const requests: {
    path: string;
    files: readonly { path: string; fingerprint: string }[];
  }[] = [];
  const subject = fixture((path, init) => {
    const body = init?.body;
    if (!(body instanceof Uint8Array))
      throw new Error('Expected request bytes');
    const parsed = Schema.decodeUnknownSync(
      Schema.fromJsonString(
        Schema.Struct({
          files: Schema.Array(
            Schema.Struct({ path: Schema.String, fingerprint: Schema.String }),
          ),
        }),
      ),
    )(new TextDecoder().decode(body));
    requests.push({ path, files: parsed.files });
    return Promise.resolve(answer(parsed.files, requests.length));
  });
  return { ...subject, requests };
}
const entries = Array.from({ length: 2001 }, (_, number) => ({
  path: `file-${number}`,
  fingerprint,
  reviewStatus: 'unreviewed' as const,
}));
it('chunks bulk marks at the wire limit and reports partial conflicts without losing later marks', async () => {
  const subject = bulkFixture((files, number) =>
    Response.json({
      worktreeId: scope.worktreeId,
      marks: [],
      marked: files
        .filter((file) => file.path !== 'file-1')
        .map((file) => file.path),
      conflicts: number === 1 ? [{ path: 'file-1', reason: 'stale' }] : [],
    }),
  );
  const result = await execute(subject, subject.commands.bulk, {
    kind: 'mark',
    entries,
  });
  if (result.kind !== 'mark') throw new Error('Expected a mark report');
  expect(subject.requests.map((request) => request.files.length)).toEqual([
    2000, 1,
  ]);
  expect(subject.requests[1]?.files).toEqual([
    { path: 'file-2000', fingerprint },
  ]);
  expect(result.report.marked).toHaveLength(2000);
  expect(result.report.failed).toEqual([
    {
      path: 'file-1',
      error: new Error('The file changed since it was shown.'),
    },
  ]);
  expect(result.report.skipped).toEqual([]);
});
it('stops a bulk operation after its first refused chunk', async () => {
  const subject = bulkFixture(() =>
    Response.json(
      { statusCode: 403, error: 'Forbidden', message: 'Review refused' },
      { status: 403 },
    ),
  );
  await expect(
    execute(subject, subject.commands.bulk, { kind: 'mark', entries }),
  ).rejects.toMatchObject({ message: 'Review refused', status: 403 });
  expect(subject.requests.map((request) => request.files.length)).toEqual([
    2000,
  ]);
});
it('uses the selected branch for reads and unmarks, its declared base for marks, and one read owner across base choices', async () => {
  const requests: { path: string; method: string; body: unknown }[] = [];
  const range: ReviewRange = {
    kind: 'branch',
    base: 'refs/heads/main',
    branch: 'refs/heads/topic',
  };
  const subject = fixture((path, init) => {
    const bytes = init?.body;
    requests.push({
      path,
      method: init?.method ?? 'GET',
      body:
        bytes instanceof Uint8Array
          ? JSON.parse(new TextDecoder().decode(bytes))
          : null,
    });
    return Promise.resolve(
      Response.json({
        worktreeId: scope.worktreeId,
        marks: [],
        marked: [],
        conflicts: [],
      }),
    );
  }, range);
  const otherBase: ReviewRange = { ...range, base: 'refs/heads/other' };
  expect(subject.state).toBe(
    readReviewedFiles({
      scope,
      connection: subject.connection,
      range: otherBase,
    }),
  );
  await read(subject, subject.state);
  await execute(subject, subject.commands.remove, 'README.md');
  await execute(subject, subject.commands.bulk, {
    kind: 'unmark',
    paths: ['README.md'],
  });
  await execute(subject, subject.commands.bulk, {
    kind: 'mark',
    entries: [{ path: 'README.md', fingerprint, reviewStatus: 'unreviewed' }],
  });
  expect(requests[0]?.path).toBe(
    `/api/worktrees/${scope.worktreeId}/reviewed?scope=branch&branch=refs%2Fheads%2Ftopic`,
  );
  expect(requests.filter((request) => request.method !== 'GET')).toEqual([
    {
      path: `/api/worktrees/${scope.worktreeId}/reviewed?path=README.md&scope=branch&branch=refs%2Fheads%2Ftopic`,
      method: 'DELETE',
      body: null,
    },
    {
      path: `/api/worktrees/${scope.worktreeId}/reviewed-bulk`,
      method: 'DELETE',
      body: {
        paths: ['README.md'],
        scope: 'branch',
        branch: 'refs/heads/topic',
      },
    },
    {
      path: `/api/worktrees/${scope.worktreeId}/reviewed-bulk`,
      method: 'PUT',
      body: {
        files: [{ path: 'README.md', fingerprint }],
        scope: 'branch',
        base: 'refs/heads/main',
      },
    },
  ]);
});
