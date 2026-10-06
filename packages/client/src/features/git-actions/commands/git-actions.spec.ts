import { Layer, Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { generateCommitDraft } from './git-actions.ts';

const scope = {
  projectId: 'project',
  worktreeId: '0123456789abcdef0123456789abcdef',
};
const input = {
  mode: 'message' as const,
  model: 'model',
  paths: ['README.md'],
  expectedStatusToken: 'a'.repeat(64),
};
const draft = {
  groups: [{ message: 'Save readme', paths: ['README.md'] }],
  expectedFiles: [{ path: 'README.md', fingerprint: 'b'.repeat(64) }],
};

function setup(transport: Transport) {
  const lifetime = createWorktreeConnection(
    {
      environmentId: 'draft',
      transport,
      timeoutMs: 1000,
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  const command = generateCommitDraft({
    connection: lifetime.connection,
    scope,
  });
  return {
    run: (request: typeof input & { signal?: AbortSignal }) => {
      registry.set(command, request);
      return Effect.runPromise(
        AtomRegistry.getResult(registry, command, { suspendOnWaiting: true }),
      );
    },
    close: async () => {
      registry.dispose();
      await lifetime.close();
    },
  };
}

it('sends the selected model and observation and validates every returned draft group', async () => {
  const sent: { path: string; body: unknown }[] = [];
  const subject = setup((path, init) => {
    if (!(init?.body instanceof Uint8Array))
      throw new Error('Expected request bytes');
    const body: unknown = JSON.parse(new TextDecoder().decode(init.body));
    sent.push({ path, body });
    return Promise.resolve(
      Response.json(
        sent.length === 1
          ? draft
          : { ...draft, groups: [{ message: '', paths: [] }] },
      ),
    );
  });
  try {
    expect(await subject.run(input)).toEqual(draft);
    expect(sent).toEqual([
      {
        path: `/api/worktrees/${scope.worktreeId}/git/commit-draft`,
        body: input,
      },
    ]);
    await expect(subject.run(input)).rejects.toThrow();
  } finally {
    await subject.close();
  }
});

it('refuses an invalid observation before sending a draft request', async () => {
  let requests = 0;
  const subject = setup(() => {
    requests++;
    return Promise.resolve(Response.json(draft));
  });
  try {
    await expect(
      subject.run({ ...input, expectedStatusToken: 'invalid' }),
    ).rejects.toThrow();
    expect(requests).toBe(0);
  } finally {
    await subject.close();
  }
});

it('cancels the generation transport when the form withdraws its draft', async () => {
  const started = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  const response = Promise.withResolvers<Response>();
  const subject = setup((_, init) => {
    init?.signal?.addEventListener('abort', () => cancelled.resolve(), {
      once: true,
    });
    started.resolve();
    return response.promise;
  });
  const controller = new AbortController();
  try {
    const failure = expect(
      subject.run({ ...input, signal: controller.signal }),
    ).rejects.toThrow();
    await started.promise;
    controller.abort();
    await cancelled.promise;
    response.resolve(Response.json(draft));
    await failure;
  } finally {
    response.resolve(Response.json(draft));
    await subject.close();
  }
});
