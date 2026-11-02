import { NodeServices } from '@effect/platform-node';
import { IdSource } from '@porcelain/kernel/ports';
import { AgentFeedbackConflictError } from '@porcelain/reviews/errors';
import {
  AgentFeedbackStore,
  CommentStore,
  ReviewStore,
} from '@porcelain/reviews/ports';
import {
  AgentFeedbackService,
  ReadReviewRecordService,
  ReadReviewRevisionService,
} from '@porcelain/reviews/services';
import { reviewFixture, reviewSave } from '@porcelain/reviews/store-contracts';
import { storageLayer } from '@porcelain/storage';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import {
  ReviewAgentHost,
  type ReviewAgentHostRequest,
} from '@porcelain/reviews/ports';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { AgentFeedbackUseCase } from './agent-feedback.ts';

const review = reviewFixture();
const key = { reviewId: review.reviewId };
const session = { kind: 't3', threadId: 'existing-t3-session' } as const;
const send = { ...key, kind: 'send', reviewRevision: 1 } as const;

async function fixture(directory: string) {
  const accepted: ReviewAgentHostRequest[] = [];
  let unavailable = false;
  const host = ReviewAgentHost.of({
    execute: (input) =>
      Effect.gen(function* () {
        if (unavailable)
          return yield* new AgentFeedbackConflictError({
            ...key,
            reason: 'recipient-unavailable',
          });
        if (input.kind === 'send') accepted.push(input);
      }),
  });
  const resources = Layer.mergeAll(
    storageLayer(directory, { worktreeIdLength: 32, busyTimeoutMs: 5000 }),
    Layer.succeed(ReviewAgentHost, host),
    Layer.succeed(IdSource, { next: randomUUID }),
    Layer.succeed(EventPublisher, {
      inventoryChanged: () => Effect.void,
      projectChanged: () => Effect.void,
      worktreeChanged: () => Effect.void,
      filesChanged: () => Effect.void,
      gitActionChanged: () => Effect.void,
      gitActionProgressed: () => Effect.void,
    }),
    LaneKeys.layer,
    Lanes.layer.pipe(
      Layer.provide(
        Layer.succeed(LaneOptions, {
          readCapacity: 2,
          deadlineMs: 5000,
          consistency: { execute: () => Effect.void },
        }),
      ),
    ),
  ).pipe(Layer.provide(NodeServices.layer));
  const services = Layer.mergeAll(
    ReadReviewRecordService.layer,
    ReadReviewRevisionService.layer,
  ).pipe(Layer.provideMerge(resources));
  const runtime = ManagedRuntime.make(
    AgentFeedbackUseCase.layer.pipe(
      Layer.provide(AgentFeedbackService.layer),
      Layer.provideMerge(services),
    ),
  );
  const subject = await runtime.runPromise(AgentFeedbackUseCase);
  const reviews = await runtime.runPromise(ReviewStore);
  const comments = await runtime.runPromise(CommentStore);
  const store = await runtime.runPromise(AgentFeedbackStore);
  return {
    runtime,
    reviews,
    comments,
    store,
    accepted,
    unavailable: () => {
      unavailable = true;
    },
    execute: (input: Parameters<typeof subject.execute>[0]) =>
      runtime.runPromise(subject.execute(input)),
    refuse: (input: Parameters<typeof subject.execute>[0]) =>
      runtime.runPromise(subject.execute(input).pipe(Effect.flip)),
    connect: () =>
      runtime.runPromise(subject.execute({ ...key, kind: 'connect', session })),
    comment: () =>
      runtime.runPromise(
        comments.insert({
          content: {
            id: randomUUID(),
            worktreeId: review.worktreeId,
            review: { ...key, revision: 1, headOid: review.headOid },
            anchor: { kind: 'file', filePath: 'README.md' },
            messages: [
              {
                id: randomUUID(),
                author: 'reviewer',
                body: 'Please explain this decision',
              },
            ],
          },
          writtenByAgent: false,
          sizeBytes: 28,
        }),
      ),
  };
}

let directory: string;
let opened: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-feedback-usecase-'));
  opened = await fixture(directory);
  await opened.runtime.runPromise(opened.reviews.save(reviewSave(review)));
});
afterEach(async () => {
  await opened.runtime.dispose();
  await rm(directory, { recursive: true, force: true });
});

it('queues one saved batch to the associated worktree and accepts its acknowledgement only once', async () => {
  const comment = await opened.comment();
  await opened.connect();
  const first = await opened.execute(send);
  expect(first).toMatchObject({
    session,
    currentCommentRevision: 1,
    delivery: {
      state: 'delivered',
      attempted: true,
      reviewRevision: 1,
      commentRevision: 1,
    },
  });
  expect(opened.accepted).toHaveLength(1);
  expect(opened.accepted[0]).toMatchObject({
    ...key,
    kind: 'send',
    session,
    worktreePath: '/repositories/project',
  });
  expect(
    opened.accepted[0]?.kind === 'send' ? opened.accepted[0].message : '',
  ).toContain(
    `Delivery ${first.delivery?.id}; review ${key.reviewId}; revision 1; comment watermark 1`,
  );
  expect(await opened.execute(send)).toEqual(first);
  expect(opened.accepted).toHaveLength(1);
  const ack = {
    ...key,
    kind: 'acknowledge',
    deliveryId: first.delivery?.id ?? '',
  } as const;
  expect(await opened.execute(ack)).toMatchObject({
    acknowledgementAccepted: true,
    delivery: { state: 'acknowledged' },
  });
  expect(await opened.execute(ack)).toMatchObject({
    acknowledgementAccepted: false,
    delivery: { state: 'acknowledged' },
  });
  expect(await opened.runtime.runPromise(opened.comments.list(key))).toEqual([
    comment,
  ]);
});

it('keeps an uncertain attempt durable across restart and refuses a newer batch without resending', async () => {
  await opened.connect();
  opened.unavailable();
  const uncertain = await opened.execute(send);
  expect(uncertain).toMatchObject({
    delivery: {
      state: 'pending',
      attempted: true,
      error:
        'Delivery could not be confirmed. It will not be sent again automatically.',
    },
  });
  await opened.runtime.dispose();
  opened = await fixture(directory);
  expect(await opened.execute({ ...key, kind: 'read' })).toEqual(uncertain);
  expect(await opened.execute(send)).toEqual(uncertain);
  await opened.comment();
  expect(await opened.refuse(send)).toMatchObject({
    reason: 'delivery-pending',
  });
  expect(opened.accepted).toEqual([]);
  expect(
    await opened.execute({
      ...key,
      kind: 'acknowledge',
      deliveryId: uncertain.delivery?.id ?? '',
    }),
  ).toMatchObject({ acknowledgementAccepted: true });
  expect(await opened.execute(send)).toMatchObject({
    delivery: { state: 'delivered', commentRevision: 1 },
  });
  expect(opened.accepted).toHaveLength(1);
});

it('does not let a different review in the same worktree advance this batch watermark', async () => {
  await opened.connect();
  const first = await opened.execute(send);
  const other = reviewFixture({
    reviewId: randomUUID(),
    branch: 'other-review',
    summaryToken: 'other-summary',
  });
  await opened.runtime.runPromise(opened.reviews.save(reviewSave(other)));
  await opened.runtime.runPromise(
    opened.comments.insert({
      content: {
        id: randomUUID(),
        worktreeId: review.worktreeId,
        review: {
          reviewId: other.reviewId,
          revision: 1,
          headOid: other.headOid,
        },
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: [
          { id: randomUUID(), author: 'reviewer', body: 'Unrelated feedback' },
        ],
      },
      sizeBytes: 18,
      writtenByAgent: false,
    }),
  );
  expect(await opened.execute(send)).toEqual(first);
  expect(opened.accepted).toHaveLength(1);
});

it('refuses missing recipients, stale revisions and closed or archived reviews without queuing work', async () => {
  expect(await opened.refuse(send)).toMatchObject({
    reason: 'session-missing',
  });
  await opened.connect();
  expect(await opened.refuse({ ...send, reviewRevision: 2 })).toMatchObject({
    reason: 'stale-feedback',
  });
  await opened.runtime.runPromise(
    opened.reviews.setState({ ...key, state: 'closed' }),
  );
  expect(await opened.refuse(send)).toMatchObject({
    reason: 'review-inactive',
  });
  expect(
    await opened.refuse({ ...key, kind: 'connect', session }),
  ).toMatchObject({ reason: 'review-inactive' });
  await opened.runtime.runPromise(
    opened.reviews.setState({ ...key, state: 'open' }),
  );
  await opened.runtime.runPromise(opened.reviews.archive(key));
  expect(await opened.refuse(send)).toMatchObject({
    reason: 'review-inactive',
  });
  expect(await opened.runtime.runPromise(opened.store.read(key))).toEqual({
    session,
  });
  expect(opened.accepted).toEqual([]);
});

it('disconnects without deleting saved comments and rejects the old delivery acknowledgement', async () => {
  const comment = await opened.comment();
  await opened.connect();
  const sent = await opened.execute(send);
  expect(await opened.execute({ ...key, kind: 'disconnect' })).toEqual({
    currentCommentRevision: 1,
  });
  expect(await opened.runtime.runPromise(opened.comments.list(key))).toEqual([
    comment,
  ]);
  expect(
    await opened.refuse({
      ...key,
      kind: 'acknowledge',
      deliveryId: sent.delivery?.id ?? '',
    }),
  ).toMatchObject({ reason: 'delivery-mismatch' });
  expect(await opened.refuse(send)).toMatchObject({
    reason: 'session-missing',
  });
  expect(opened.accepted).toHaveLength(1);
});
