import type { AgentFeedbackConflictError } from '@porcelain/reviews/errors';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { AgentFeedbackStore, ReviewStore } from '@porcelain/reviews/ports';
import { reviewFixture, reviewSave } from '@porcelain/reviews/store-contracts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { storageLayer } from '../../index.ts';

function runtime(directory: string) {
  return ManagedRuntime.make(
    storageLayer(directory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
}

const reviewId = '10000000-0000-4000-8000-000000000001';
const deliveryId = '20000000-0000-4000-8000-000000000001';
const newerDeliveryId = '20000000-0000-4000-8000-000000000002';
const key = { reviewId };
const event = { reviewId, deliveryId };
const batch = { ...event, reviewRevision: 1, commentRevision: 7 };
const session = { kind: 't3', threadId: 't3-thread' } as const;
const pending = {
  id: deliveryId,
  reviewId,
  reviewRevision: 1,
  commentRevision: 7,
  state: 'pending',
  attempted: false,
};

describe('SQLite agent feedback handoff', () => {
  let directory: string;
  let runtimes: ReturnType<typeof runtime>[];
  let store: AgentFeedbackStore;
  async function open() {
    const opened = runtime(directory);
    runtimes.push(opened);
    return {
      runtime: opened,
      store: await opened.runPromise(AgentFeedbackStore),
    };
  }
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'porcelain-feedback-storage-'));
    runtimes = [];
    const opened = await open();
    store = opened.store;
    const reviews = await opened.runtime.runPromise(ReviewStore);
    await Effect.runPromise(reviews.save(reviewSave(reviewFixture())));
  });
  afterEach(async () => {
    for (const opened of runtimes) await opened.dispose();
    rmSync(directory, { recursive: true, force: true });
  });

  it('persists the recipient and an unknown send across reopen without allowing another claim', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    expect(await Effect.runPromise(store.enqueue(batch))).toEqual({
      session,
      delivery: pending,
    });
    expect(await Effect.runPromise(store.begin(event))).toBe(true);
    await Effect.runPromise(
      store.failed({
        ...event,
        error: 'T3 disconnected after accepting the command',
      }),
    );
    for (const opened of runtimes) await opened.dispose();
    runtimes = [];
    store = (await open()).store;
    expect(await Effect.runPromise(store.read(key))).toEqual({
      session,
      delivery: {
        ...pending,
        attempted: true,
        error: 'T3 disconnected after accepting the command',
      },
    });
    expect(await Effect.runPromise(store.begin(event))).toBe(false);
    expect(
      await Effect.runPromise(
        store
          .enqueue({
            ...batch,
            deliveryId: newerDeliveryId,
            commentRevision: 8,
          })
          .pipe(Effect.flip),
      ),
    ).toMatchObject({
      _tag: 'AgentFeedbackConflictError',
      reason: 'delivery-pending',
    });
  });

  it('allows only one concurrent claimant through independent SQLite connections', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    await Effect.runPromise(store.enqueue(batch));
    const other = (await open()).store;
    const claims = await Promise.all([
      Effect.runPromise(store.begin(event)),
      Effect.runPromise(other.begin(event)),
    ]);
    expect(claims.sort((left, right) => Number(left) - Number(right))).toEqual([
      false,
      true,
    ]);
    expect(await Effect.runPromise(other.read(key))).toEqual({
      session,
      delivery: { ...pending, attempted: true },
    });
  });

  it('keeps the same batch identity and status when an enqueue is repeated with another generated id', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    await Effect.runPromise(store.enqueue(batch));
    await Effect.runPromise(store.begin(event));
    await Effect.runPromise(
      store.failed({ ...event, error: 'Unknown send result' }),
    );
    const unknown = {
      session,
      delivery: { ...pending, attempted: true, error: 'Unknown send result' },
    };
    expect(
      await Effect.runPromise(
        store.enqueue({ ...batch, deliveryId: newerDeliveryId }),
      ),
    ).toEqual(unknown);
    expect(await Effect.runPromise(store.begin(event))).toBe(false);
    await Effect.runPromise(store.acknowledge(event));
    expect(
      await Effect.runPromise(
        store.enqueue({ ...batch, deliveryId: newerDeliveryId }),
      ),
    ).toEqual({
      session,
      delivery: { ...pending, state: 'acknowledged', attempted: true },
    });
  });

  it('preserves a repeated connection and requires explicit disconnect before changing recipients', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    await Effect.runPromise(store.enqueue(batch));
    expect(await Effect.runPromise(store.connect({ ...key, session }))).toEqual(
      { session, delivery: pending },
    );
    const next = { ...session, threadId: 'another-t3-thread' };
    expect(
      await Effect.runPromise(
        store.connect({ ...key, session: next }).pipe(Effect.flip),
      ),
    ).toMatchObject({ reason: 'session-connected' });
    expect(await Effect.runPromise(store.read(key))).toEqual({
      session,
      delivery: pending,
    });
    await Effect.runPromise(store.disconnect(key));
    expect(
      await Effect.runPromise(store.connect({ ...key, session: next })),
    ).toEqual({ session: next });
    expect(
      await Effect.runPromise(store.acknowledge(event).pipe(Effect.flip)),
    ).toMatchObject({
      _tag: 'AgentFeedbackConflictError',
      reason: 'delivery-mismatch',
    });
    await Effect.runPromise(store.enqueue(batch));
    expect(await Effect.runPromise(store.disconnect(key))).toEqual({});
    expect(await Effect.runPromise(store.read(key))).toEqual({});
    expect(await Effect.runPromise(store.disconnect(key))).toEqual({});
  });

  it('does not let MCP reconnect erase an uncertain attempt and authorize another send', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    await Effect.runPromise(store.enqueue(batch));
    await Effect.runPromise(store.begin(event));
    const uncertain = await Effect.runPromise(
      store.failed({ ...event, error: 'The response was lost' }),
    );
    expect(
      await Effect.runPromise(
        store
          .connect({
            ...key,
            session: { kind: 't3', threadId: 'replacement-thread' },
          })
          .pipe(Effect.flip),
      ),
    ).toMatchObject({ reason: 'session-connected' });
    expect(await Effect.runPromise(store.read(key))).toEqual(uncertain);
    expect(await Effect.runPromise(store.begin(event))).toBe(false);
    expect(await Effect.runPromise(store.acknowledge(event))).toMatchObject({
      accepted: true,
      feedback: {
        session,
        delivery: { id: deliveryId, state: 'acknowledged' },
      },
    });
  });

  it.each(['delivered', 'failed', 'acknowledge', 'begin'] as const)(
    'rejects stale %s without altering the newer batch',
    async (operation) => {
      await Effect.runPromise(store.connect({ ...key, session }));
      await Effect.runPromise(store.enqueue(batch));
      await Effect.runPromise(store.begin(event));
      await Effect.runPromise(store.acknowledge(event));
      const newer = {
        ...batch,
        deliveryId: newerDeliveryId,
        commentRevision: 8,
      };
      const state = await Effect.runPromise(store.enqueue(newer));
      expect(state).toEqual({
        session,
        delivery: { ...pending, id: newerDeliveryId, commentRevision: 8 },
      });
      const operations: Record<
        'delivered' | 'failed' | 'acknowledge' | 'begin',
        Effect.Effect<void, AgentFeedbackConflictError>
      > = {
        delivered: store.delivered(event).pipe(Effect.asVoid),
        failed: store
          .failed({ ...event, error: 'stale failure' })
          .pipe(Effect.asVoid),
        acknowledge: store.acknowledge(event).pipe(Effect.asVoid),
        begin: store.begin(event).pipe(Effect.asVoid),
      };
      expect(
        await Effect.runPromise(Effect.flip(operations[operation])),
      ).toMatchObject({
        _tag: 'AgentFeedbackConflictError',
        reason: 'delivery-mismatch',
      });
      expect(
        await Effect.runPromise(store.enqueue(batch).pipe(Effect.flip)),
      ).toMatchObject({
        _tag: 'AgentFeedbackConflictError',
        reason: 'stale-feedback',
      });
      expect(await Effect.runPromise(store.read(key))).toEqual(state);
    },
  );

  it('retains acknowledgement when it arrives before the delivery completion or failure', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    await Effect.runPromise(store.enqueue(batch));
    await Effect.runPromise(store.begin(event));
    const acknowledged = {
      session,
      delivery: { ...pending, state: 'acknowledged', attempted: true },
    };
    expect(await Effect.runPromise(store.acknowledge(event))).toEqual({
      feedback: acknowledged,
      accepted: true,
    });
    expect(await Effect.runPromise(store.delivered(event))).toEqual(
      acknowledged,
    );
    expect(
      await Effect.runPromise(
        store.failed({ ...event, error: 'Late transport failure' }),
      ),
    ).toEqual(acknowledged);
    expect(await Effect.runPromise(store.acknowledge(event))).toEqual({
      feedback: acknowledged,
      accepted: false,
    });
    expect(await Effect.runPromise(store.begin(event))).toBe(false);
  });

  it('accepts only one concurrent acknowledgement through independent SQLite connections', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    await Effect.runPromise(store.enqueue(batch));
    await Effect.runPromise(store.begin(event));
    const other = (await open()).store;
    const receipts = await Promise.all([
      Effect.runPromise(store.acknowledge(event)),
      Effect.runPromise(other.acknowledge(event)),
    ]);
    expect(
      receipts
        .map((receipt) => receipt.accepted)
        .sort((left, right) => Number(left) - Number(right)),
    ).toEqual([false, true]);
    expect(receipts.map((receipt) => receipt.feedback)).toEqual([
      {
        session,
        delivery: { ...pending, state: 'acknowledged', attempted: true },
      },
      {
        session,
        delivery: { ...pending, state: 'acknowledged', attempted: true },
      },
    ]);
  });

  it('keeps successful delivery monotonic and clears the earlier unknown-send error', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    await Effect.runPromise(store.enqueue(batch));
    await Effect.runPromise(store.begin(event));
    await Effect.runPromise(store.failed({ ...event, error: 'Lost response' }));
    const delivered = {
      session,
      delivery: { ...pending, state: 'delivered', attempted: true },
    };
    expect(await Effect.runPromise(store.delivered(event))).toEqual(delivered);
    expect(
      await Effect.runPromise(store.failed({ ...event, error: 'Late error' })),
    ).toEqual(delivered);
    expect(await Effect.runPromise(store.begin(event))).toBe(false);
  });

  it('reports missing recipients and delivery identities as typed conflicts', async () => {
    expect(await Effect.runPromise(store.read(key))).toEqual({});
    expect(
      await Effect.runPromise(store.enqueue(batch).pipe(Effect.flip)),
    ).toMatchObject({
      _tag: 'AgentFeedbackConflictError',
      reason: 'session-missing',
    });
    expect(
      await Effect.runPromise(store.begin(event).pipe(Effect.flip)),
    ).toMatchObject({
      _tag: 'AgentFeedbackConflictError',
      reason: 'delivery-mismatch',
    });
  });

  it('supports a retained review without a registered worktree and cascades review deletion', async () => {
    await Effect.runPromise(store.connect({ ...key, session }));
    await Effect.runPromise(store.enqueue(batch));
    expect(await Effect.runPromise(store.read(key))).toEqual({
      session,
      delivery: pending,
    });
    const opened = await open();
    const reviews = await opened.runtime.runPromise(ReviewStore);
    expect(await Effect.runPromise(reviews.remove(key))).toBe(true);
    expect(await Effect.runPromise(store.read(key))).toEqual({});
    expect(
      await Effect.runPromise(store.acknowledge(event).pipe(Effect.flip)),
    ).toMatchObject({
      _tag: 'AgentFeedbackConflictError',
      reason: 'delivery-mismatch',
    });
  });
});
