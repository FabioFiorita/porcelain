import { afterEach, expect, it } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const owned: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of owned) await close();
  owned.length = 0;
});
function fixture(transport: Transport, cacheIdentity?: readonly string[]) {
  const lifetime = createWorktreeConnection({
    environmentId: 'environment',
    transport,
    timeoutMs: 10_000,
    ...(cacheIdentity ? { cacheIdentity } : {}),
  });
  const registry = AtomRegistry.make();
  owned.push(async () => {
    registry.dispose();
    await lifetime.close();
  });
  return { ...lifetime, registry };
}
import { readTextFile } from './text.ts';
const response = {
  worktreeId: scope.worktreeId,
  path: 'README.md',
  encoding: 'utf-8',
  byteLength: 5,
  text: 'Hello',
};
function read(
  subject: ReturnType<typeof fixture>,
  path = 'README.md',
  worktree = scope,
) {
  return Effect.runPromise(
    AtomRegistry.getResult(
      subject.registry,
      readTextFile({ connection: subject.connection, scope: worktree, path }),
    ),
  );
}
it('isolates worktrees, paths and replacement credentials while sharing an active read', async () => {
  const sent: string[] = [];
  const transport: Transport = (path) => {
    sent.push(path);
    const url = new URL(path, 'http://test.invalid');
    return Promise.resolve(
      Response.json({
        ...response,
        worktreeId: url.pathname.split('/')[3],
        path: url.searchParams.get('path'),
      }),
    );
  };
  const first = fixture(transport, ['first']);
  const replacement = fixture(transport, ['replacement']);
  const query = readTextFile({
    connection: first.connection,
    scope,
    path: 'README.md',
  });
  const stop = first.registry.mount(query);
  try {
    expect(await read(first)).toMatchObject({
      path: 'README.md',
      text: 'Hello',
    });
    expect(await read(first)).toMatchObject({
      path: 'README.md',
      text: 'Hello',
    });
    expect(await read(first, 'other.md')).toMatchObject({ path: 'other.md' });
    expect(
      await read(first, 'README.md', {
        ...scope,
        worktreeId: '11111111111111111111111111111111',
      }),
    ).toMatchObject({ worktreeId: '11111111111111111111111111111111' });
    expect(await read(replacement)).toMatchObject({
      path: 'README.md',
      text: 'Hello',
    });
    expect(sent).toEqual([
      `/api/worktrees/${scope.worktreeId}/text?path=README.md`,
      `/api/worktrees/${scope.worktreeId}/text?path=other.md`,
      '/api/worktrees/11111111111111111111111111111111/text?path=README.md',
      `/api/worktrees/${scope.worktreeId}/text?path=README.md`,
    ]);
  } finally {
    stop();
  }
});
it('rejects another worktree returned by the transport', async () => {
  const subject = fixture(() =>
    Promise.resolve(
      Response.json({
        ...response,
        worktreeId: '11111111111111111111111111111111',
      }),
    ),
  );
  await expect(read(subject)).rejects.toThrow('The connected context changed.');
});
it('rejects a response after disconnect even when transport ignores cancellation', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const subject = fixture(() => {
    started.resolve();
    return held.promise;
  });
  const result = read(subject);
  const rejected = expect(result).rejects.toThrow();
  await started.promise;
  subject.controller.abort();
  held.resolve(Response.json(response));
  await rejected;
  expect(subject.controller.signal.aborted).toBe(true);
});
it('unmount cancels the active transport read', async () => {
  const started = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const held = Promise.withResolvers<Response>();
  const subject = fixture((_, init) => {
    init?.signal?.addEventListener(
      'abort',
      () => {
        aborted.resolve();
        held.resolve(Response.json(response));
      },
      { once: true },
    );
    started.resolve();
    return held.promise;
  });
  const stop = subject.registry.mount(
    readTextFile({ connection: subject.connection, scope, path: 'README.md' }),
  );
  await started.promise;
  stop();
  await aborted.promise;
  expect(subject.controller.signal.aborted).toBe(false);
});
