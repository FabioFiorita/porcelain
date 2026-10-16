import { Effect, Layer } from 'effect';
import { AtomRegistry, AsyncResult } from 'effect/reactivity';
import {
  completeDecision,
  decisionCompletionBinding,
} from '@porcelain/client/reviews';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { expect, it } from 'vitest';
import { reviewContinuation } from './store';

it.each([
  { leaves: true, destination: 'briefing', scope: 'original' },
  { leaves: true, destination: 'decision-3', scope: 'original' },
  { leaves: true, destination: 'briefing', scope: 'another-worktree' },
  { leaves: true, destination: 'file-diff', scope: 'original' },
  { leaves: false, destination: 'decision-2', scope: 'original' },
])(
  'keeps $destination in $scope after delayed completion (leaves: $leaves)',
  async ({ leaves, destination, scope: viewScope }) => {
    const scheduled: Array<() => void> = [];
    const views = AtomRegistry.make({
      scheduleTask: (task) => {
        scheduled.push(task);
        return () => undefined;
      },
    });
    const atom = reviewContinuation(`${destination}-${viewScope}`);
    const leave = views.mount(atom);
    const continueIfActive = views.get(atom);
    const registry = AtomRegistry.make();
    const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
    const fingerprint = 'b'.repeat(64);
    const layerId = '11111111-1111-4111-8111-111111111111';
    const reviewedAt = '2026-10-15T12:00:00.000Z';
    const writes: string[] = [];
    let marks: unknown[] = [];
    let layers: unknown[] = [];
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const client = createWorktreeConnection(
      {
        environmentId: 'original',
        timeoutMs: 10_000,
        transport: async (path, init) => {
          if (init?.method === 'PUT') {
            writes.push(`${init.method} ${path}`);
            if (path.endsWith('reviewed-bulk')) {
              started();
              await delayed;
              marks = [{ path: 'owner.ts', fingerprint, reviewedAt }];
              return Response.json({
                worktreeId: scope.worktreeId,
                marks,
                marked: ['owner.ts'],
                conflicts: [],
              });
            }
            layers = [{ layerId, fingerprint, reviewedAt, stale: false }];
          }
          return Response.json({
            worktreeId: scope.worktreeId,
            marks: path.endsWith('reviewed-layers') ? layers : marks,
          });
        },
      },
      undefined,
      Layer.empty,
    );
    let place = { scope: 'original', stop: 'decision-1' };
    const command = completeDecision({ connection: client.connection, scope });
    let pending: Promise<unknown> | undefined;
    const notices: unknown[] = [];
    const completion = decisionCompletionBinding(
      [
        AsyncResult.initial(),
        (input) => {
          registry.set(command, input);
          const result = Effect.runPromiseExit(
            AtomRegistry.getResult(registry, command, {
              suspendOnWaiting: true,
            }),
          );
          pending = result;
          return result;
        },
      ],
      (notice) => notices.push(notice),
    );
    try {
      completion.complete({
        files: [{ path: 'owner.ts', fingerprint, reviewStatus: 'unreviewed' }],
        decision: { layerId, fingerprint, reviewed: false },
        onDone: () =>
          continueIfActive(() => {
            place = { scope: 'original', stop: 'decision-2' };
          }),
      });
      await requestStarted;
      if (leaves) {
        place = { scope: viewScope, stop: destination };
        leave();
        while (scheduled.length) scheduled.shift()!();
      }
      release();
      await pending;
      expect(place).toEqual({ scope: viewScope, stop: destination });
      expect(writes).toEqual([
        `PUT /api/worktrees/${scope.worktreeId}/reviewed-bulk`,
        `PUT /api/worktrees/${scope.worktreeId}/reviewed-layers`,
      ]);
      expect(marks).toEqual([{ path: 'owner.ts', fingerprint, reviewedAt }]);
      expect(layers).toEqual([
        { layerId, fingerprint, reviewedAt, stale: false },
      ]);
      expect(notices).toEqual([]);
    } finally {
      views.dispose();
      registry.dispose();
      await client.close();
    }
  },
);
