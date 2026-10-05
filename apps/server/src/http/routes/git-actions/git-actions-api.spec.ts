import { Effect } from 'effect';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../../server-factory.ts';
import { mountEffectRoutes } from '../../effect-bridge.ts';
import { gitActionsRoutes } from './git-actions-api.ts';

const worktreeId = '0123456789abcdef0123456789abcdef';
const requestId = '8d349263-380b-4f05-946c-09f8220e5c93';
const receipt = {
  projectId: '24f5e56c-3bf6-4cf2-bf34-2d3b58023d53',
  worktreeId,
  requestId,
  action: 'fetch' as const,
  state: 'running' as const,
  progress: [],
  acceptedAt: '2026-10-05T05:00:00.000Z',
};
const request = {
  requestId,
  input: {
    action: 'fetch',
    remoteName: 'origin',
    sourceRef: 'refs/heads/main',
  },
  expected: {
    headOid: null,
    branch: null,
    inProgress: null,
    mergeHeadOid: null,
  },
};
const opened: { server: FastifyInstance; dispose: () => Promise<void> }[] = [];

afterEach(async () => {
  for (const { server, dispose } of opened.splice(0)) {
    await server.close();
    await dispose();
  }
});

async function serverFor(
  state:
    | 'running'
    | 'succeeded'
    | 'no-change'
    | 'rejected'
    | 'conflicted'
    | 'interrupted',
  captured: unknown[] = [],
) {
  const server = createServer({
    logger: { failure: () => undefined },
    principal: { kind: 'owner' },
  });
  const routes = gitActionsRoutes({
    runGitAction: {
      execute: (input) => {
        captured.push(input);
        return Effect.succeed({ ...receipt, state });
      },
    },
    listCommitModels: {
      execute: () => Effect.succeed([{ id: 'codex:one', label: 'One' }]),
    },
    generateCommitDraft: {
      execute: () => Effect.die(new Error('unexpected draft')),
    },
    readGitActionReceipt: {
      execute: () => Effect.succeed({ ...receipt, state }),
    },
    dismissInterruptedGitAction: {
      execute: () => Effect.succeed({ dismissed: true }),
    },
  });
  server.register(
    async (api) => {
      api.register(mountEffectRoutes, { routes });
    },
    { prefix: '/api' },
  );
  opened.push({ server, dispose: routes.dispose });
  return server;
}

describe('Git action native HTTP contract', () => {
  it.each([
    ['running', 202],
    ['succeeded', 200],
    ['no-change', 200],
    ['rejected', 409],
    ['conflicted', 409],
    ['interrupted', 503],
  ] as const)(
    'returns %s receipts at the original status %i',
    async (state, status) => {
      const captured: unknown[] = [];
      const server = await serverFor(state, captured);
      const response = await server.inject({
        method: 'POST',
        url: `/api/worktrees/${worktreeId}/git/actions`,
        payload: request,
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({ ...receipt, state });
      expect(captured).toEqual([
        {
          ...request,
          worktreeId,
          expected: {
            headOid: undefined,
            branch: undefined,
            inProgress: undefined,
            mergeHeadOid: undefined,
          },
        },
      ]);
    },
  );

  it('applies the stash index default and refuses a forged request field before invoking the use case', async () => {
    const captured: unknown[] = [];
    const server = await serverFor('running', captured);
    const stashing = {
      ...request,
      input: { action: 'stash-apply', stashOid: 'a'.repeat(40) },
    };
    const valid = await server.inject({
      method: 'POST',
      url: `/api/worktrees/${worktreeId}/git/actions`,
      payload: stashing,
    });
    expect(valid.statusCode).toBe(202);
    expect(captured).toMatchObject([
      { input: { action: 'stash-apply', restoreIndex: false } },
    ]);
    const forged = await server.inject({
      method: 'POST',
      url: `/api/worktrees/${worktreeId}/git/actions`,
      payload: { ...stashing, caller: 'owner' },
    });
    expect(forged.statusCode).toBe(400);
    expect(captured).toHaveLength(1);
  });
});
