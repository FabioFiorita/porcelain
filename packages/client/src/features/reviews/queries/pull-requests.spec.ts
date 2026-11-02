import { expect, it } from 'vitest';
import { Effect, Layer, Schema } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { createWorktreeConnection } from '@porcelain/client/transport';
import {
  readReviewPullRequest,
  readProjectPullRequests,
  readProjectGitHubAccount,
} from '../index.ts';
import { setProjectGitHubAccount } from '../index.ts';
import {
  clientFixtures,
  readClientAtom,
  visitClientRead,
} from '../../../../spec/kit/client-fixture.ts';

const create = clientFixtures();

it('keeps a confirmed project account visible while reopening refreshes it', async () => {
  const held = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const saved = {
    accounts: ['personal', 'work'],
    choice: { account: 'work', source: 'overridden' },
    override: 'work',
  };
  let reads = 0;
  const subject = create(() => {
    if (++reads === 1) return Promise.resolve(Response.json(saved));
    started.resolve();
    return held.promise;
  });
  const state = readProjectGitHubAccount({
    connection: subject.connection,
    projectId: 'project',
  });
  expect(await visitClientRead(subject.registry, state)).toEqual(saved);
  const stop = subject.registry.mount(state);
  try {
    await started.promise;
    expect(subject.registry.get(state)).toMatchObject({
      _tag: 'Success',
      value: saved,
      waiting: true,
    });
    held.resolve(
      Response.json({
        accounts: ['personal'],
        choice: { account: 'personal', source: 'detected' },
      }),
    );
    expect((await readClientAtom(subject.registry, state)).choice).toEqual({
      account: 'personal',
      source: 'detected',
    });
    expect(AsyncResult.isSuccess(subject.registry.get(state))).toBe(true);
  } finally {
    held.resolve(Response.json(saved));
    stop();
  }
});

it('updates the mounted account picker after choosing and resetting without changing another computer', async () => {
  const accountAnswer = (override: string | undefined) => ({
    repository: 'owner/repository',
    accounts: ['personal', 'work'],
    choice: {
      account: override ?? 'personal',
      source: override ? 'overridden' : 'detected',
    },
    ...(override ? { override } : {}),
  });
  let override: string | undefined;
  const chosen = create(
    async (_path, init) => {
      if (init?.method === 'PUT') {
        const body = Schema.decodeUnknownSync(
          Schema.fromJsonString(
            Schema.Struct({ account: Schema.NullOr(Schema.String) }),
          ),
        )(await new Response(init.body).text());
        override = body.account ?? undefined;
      }
      return Response.json(accountAnswer(override));
    },
    undefined,
    1000,
    'first',
  );
  const other = create(
    async () => Response.json(accountAnswer(undefined)),
    undefined,
    1000,
    'second',
  );
  const picker = readProjectGitHubAccount({
    connection: chosen.connection,
    projectId: 'project',
  });
  const otherPicker = readProjectGitHubAccount({
    connection: other.connection,
    projectId: 'project',
  });
  const command = setProjectGitHubAccount({
    connection: chosen.connection,
    projectId: 'project',
  });
  const stop = chosen.registry.mount(picker);
  const stopOther = other.registry.mount(otherPicker);
  const choices = async () => ({
    selected: (await readClientAtom(chosen.registry, picker)).choice,
    other: (await readClientAtom(other.registry, otherPicker)).choice,
  });
  const detected = { account: 'personal', source: 'detected' };
  const initial = { selected: detected, other: detected };
  try {
    expect(await choices()).toEqual(initial);
    chosen.registry.set(command, { account: 'work' });
    await readClientAtom(chosen.registry, command);
    expect(await choices()).toEqual({
      selected: { account: 'work', source: 'overridden' },
      other: detected,
    });
    chosen.registry.set(command, { account: undefined });
    await readClientAtom(chosen.registry, command);
    expect(await choices()).toEqual(initial);
  } finally {
    stop();
    stopOther();
  }
});

it('reads the selected review and project through the shared connection and preserves typed unavailability', async () => {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const lifetime = createWorktreeConnection(
    {
      environmentId: '00000000-0000-4000-8000-000000000001',
      timeoutMs: 10000,
      transport: async (path, init) => {
        calls.push(`${init?.method ?? 'GET'} ${path}`);
        if (path === '/api/reviews/10000000-0000-4000-8000-000000000001')
          return Response.json({ review: null, revisions: [], revision: null });
        if (init?.method === 'PUT') {
          bodies.push(await new Response(init.body).json());
          return Response.json({
            accounts: ['personal'],
            choice: { account: 'personal', source: 'overridden' },
            override: 'personal',
          });
        }
        return Response.json(
          path.endsWith('github-account')
            ? {
                accounts: ['personal'],
                choice: { account: 'personal', source: 'detected' },
              }
            : { kind: 'unavailable', reason: 'offline' },
        );
      },
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  try {
    const connection = lifetime.connection;
    const options = { suspendOnWaiting: true };
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(
          registry,
          readReviewPullRequest({
            connection,
            reviewId: '10000000-0000-4000-8000-000000000001',
          }),
          options,
        ),
      ),
    ).toEqual({ kind: 'unavailable', reason: 'offline' });
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(
          registry,
          readProjectPullRequests({ connection, projectId: 'project' }),
          options,
        ),
      ),
    ).toEqual({ kind: 'unavailable', reason: 'offline' });
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(
          registry,
          readProjectGitHubAccount({ connection, projectId: 'project' }),
          options,
        ),
      ),
    ).toMatchObject({ choice: { account: 'personal', source: 'detected' } });
    expect(calls).toEqual([
      'GET /api/reviews/10000000-0000-4000-8000-000000000001',
      'GET /api/reviews/10000000-0000-4000-8000-000000000001/pull-request',
      'GET /api/projects/project/pull-requests',
      'GET /api/projects/project/github-account',
    ]);
    const command = setProjectGitHubAccount({
      connection,
      projectId: 'project',
    });
    registry.set(command, { account: 'personal' });
    expect(
      await Effect.runPromise(
        AtomRegistry.getResult(registry, command, options),
      ),
    ).toMatchObject({ choice: { account: 'personal', source: 'overridden' } });
    expect(calls).toContain('PUT /api/projects/project/github-account');
    registry.set(command, { account: undefined });
    await Effect.runPromise(AtomRegistry.getResult(registry, command, options));
    expect(bodies).toEqual([{ account: 'personal' }, { account: null }]);
  } finally {
    registry.dispose();
    await lifetime.close();
  }
});
