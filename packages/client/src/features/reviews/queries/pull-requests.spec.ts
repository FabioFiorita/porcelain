import { expect, it } from 'vitest';
import { Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { createWorktreeConnection } from '@porcelain/client/transport';
import {
  readReviewPullRequest,
  readProjectPullRequests,
  readProjectGitHubAccount,
} from '../index.ts';
import { setProjectGitHubAccount } from '../index.ts';
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
