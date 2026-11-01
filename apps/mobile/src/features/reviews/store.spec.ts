import { setReviewMarkRequestSchema } from '@porcelain/contracts/reviews';
import { Effect, Layer, Schema } from 'effect';
import { AtomRegistry, AsyncResult } from 'effect/reactivity';
import {
  completeDecision,
  decisionCompletionBinding,
} from '@porcelain/client/reviews';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { expect, it } from 'vitest';
import {
  commentDraftState,
  reviewContinuation,
  type CommentDraft,
} from './store';

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
    const reviewId = '22222222-2222-4222-8222-222222222222';
    const fingerprint = 'b'.repeat(64);
    const blobOid = 'c'.repeat(40);
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
            const payload = Schema.decodeUnknownSync(
              setReviewMarkRequestSchema,
            )(await new Response(init.body).json());
            if (payload.kind === 'file') {
              started();
              await delayed;
              marks = [
                {
                  path: 'owner.ts',
                  fingerprint: blobOid,
                  reviewedAt,
                  stale: false,
                },
              ];
            } else layers = [{ layerId, fingerprint, reviewedAt }];
            return Response.json({ updated: true });
          }
          return Response.json({ files: marks, decisions: layers });
        },
      },
      undefined,
      Layer.empty,
    );
    let place = { scope: 'original', stop: 'decision-1' };
    const command = completeDecision({
      connection: client.connection,
      reviewId,
    });
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
        revision: 2,
        files: [
          {
            path: 'owner.ts',
            fingerprint: blobOid,
            reviewStatus: 'unreviewed',
          },
        ],
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
        `PUT /api/reviews/${reviewId}/marks`,
        `PUT /api/reviews/${reviewId}/marks`,
      ]);
      expect(marks).toEqual([
        { path: 'owner.ts', fingerprint: blobOid, reviewedAt, stale: false },
      ]);
      expect(layers).toEqual([{ layerId, fingerprint, reviewedAt }]);
      expect(notices).toEqual([]);
    } finally {
      views.dispose();
      registry.dispose();
      await client.close();
    }
  },
);

it('retains unsent text, its original review target and write identity when a PR replaces the active document', () => {
  const scheduled: Array<() => void> = [];
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      scheduled.push(task);
      return () => undefined;
    },
  });
  const document = commentDraftState('desk/project/topic/left/review');
  const draft: CommentDraft = {
    target: {
      anchor: { kind: 'change' },
      reviewId: 'original-review',
      reviewRevision: 3,
    },
    body: 'Keep this unsent comment while I read the PR',
    invalid: undefined,
    intent: {
      body: 'Keep this unsent comment while I read the PR',
      threadId: 'original-thread',
      messageId: 'original-message',
    },
  };
  try {
    const unmount = registry.mount(document);
    registry.set(document, draft);
    unmount();
    while (scheduled.length) scheduled.shift()!();
    const remount = registry.mount(document);
    expect(registry.get(document)).toEqual(draft);
    expect(
      registry.get(
        commentDraftState('other-computer/project/topic/left/review'),
      ),
    ).toBeUndefined();
    expect(
      registry.get(commentDraftState('desk/project/another-topic/left/review')),
    ).toBeUndefined();
    remount();
  } finally {
    registry.dispose();
  }
});
