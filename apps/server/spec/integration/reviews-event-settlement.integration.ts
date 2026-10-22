import { NodeServices } from '@effect/platform-node';
import { IdSource } from '@porcelain/kernel/ports';
import {
  BranchReviewReader,
  CommentStore,
  CreateCommentThreadOptions,
  ReplyToCommentOptions,
  EditCommentMessageOptions,
  ReviewCodeReader,
  ReviewStore,
  ReviewedLayerStore,
  ReviewedFileStore,
} from '@porcelain/reviews/ports';
import {
  CreateCommentThreadService,
  ReplyToCommentService,
  UpdateCommentThreadService,
  EditCommentMessageService,
  DeleteResolvedCommentsService,
  ReadReviewRevisionService,
  SetReviewMarkService,
  RemoveReviewMarkService,
  DeleteReviewService,
  ReadPublishedReviewService,
} from '@porcelain/reviews/services';
import { reviewFixture, reviewSave } from '@porcelain/reviews/store-contracts';
import { storageLayer } from '@porcelain/storage';
import { Context, Deferred, Effect, Fiber, Layer } from 'effect';
import { channel } from 'node:diagnostics_channel';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { EventPublisher } from '../../src/ports/event-publisher.ts';
import { LaneOptions } from '../../src/ports/lane-options.ts';
import { CheckWorktreeUseCasePort } from '../../src/ports/check-worktree-use-case-port.ts';
import { WorktreeConsistencyProbe } from '../../src/ports/worktree-consistency-probe.ts';
import { Lanes } from '../../src/runtime/lanes.ts';
import { LaneKeys } from '../../src/runtime/lane-keys.ts';
import { WorktreeAccess } from '../../src/runtime/worktree-access.ts';
import { CreateCommentThreadUseCase } from '../../src/use-cases/reviews/create-comment-thread.ts';
import { ReplyToCommentUseCase } from '../../src/use-cases/reviews/reply-to-comment.ts';
import { UpdateCommentThreadUseCase } from '../../src/use-cases/reviews/update-comment-thread.ts';
import { EditCommentMessageUseCase } from '../../src/use-cases/reviews/edit-comment-message.ts';
import { DeleteResolvedCommentsUseCase } from '../../src/use-cases/reviews/delete-resolved-comments.ts';
import { SetReviewMarkUseCase } from '../../src/use-cases/reviews/set-review-mark.ts';
import { RemoveReviewMarkUseCase } from '../../src/use-cases/reviews/remove-review-mark.ts';
import { DeleteReviewUseCase } from '../../src/use-cases/reviews/delete-review.ts';
import { record } from '../kit/session.ts';
import { LIMITS } from '../../src/config/limits.ts';

const operations = channel('porcelain:operation');
const rows = [
  ['create', ['settled', 'comments', 'inventory']],
  ['replay thread', ['settled', 'comments', 'inventory']],
  ['reply', ['settled', 'comments', 'inventory']],
  ['replay reply', ['settled', 'comments', 'inventory']],
  ['resolve', ['settled', 'comments', 'inventory']],
  ['reopen', ['settled', 'comments', 'inventory']],
  ['unchanged resolution', ['settled', 'inventory']],
  ['unchanged edit', ['settled', 'inventory']],
  ['empty deletion', ['settled', 'inventory']],
  ['delete resolved', ['settled', 'comments', 'inventory']],
  ['set decision mark', ['settled', 'inventory']],
  ['remove decision mark', ['settled', 'inventory']],
  ['delete review', ['settled', 'inventory']],
  ['failure', ['settled']],
  ['interruption', ['settled']],
  [
    'back to back',
    ['settled', 'comments', 'inventory', 'settled', 'comments', 'inventory'],
  ],
] as const;

test.each(rows)(
  '%s announces readable state only after settlement',
  async (state, expected) => {
    const folder = await mkdtemp(join(tmpdir(), 'porcelain-event-settlement-'));
    try {
      await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const storage = yield* Layer.build(
              storageLayer(folder, {
                worktreeIdLength: 32,
                busyTimeoutMs: 5000,
              }),
            );
            const reviews = Context.get(storage, ReviewStore);
            const nativeComments = Context.get(storage, CommentStore);
            const marks = Context.get(storage, ReviewedLayerStore);
            const review = reviewFixture({
              layers: [
                {
                  id: 'decision',
                  title: 'Event timing',
                  summary: 'Publish durable state',
                  lanes: [],
                  steps: [],
                  fingerprint: 'decision-fingerprint',
                },
              ],
            });
            yield* reviews.save(reviewSave(review));
            const input = {
              reviewId: review.reviewId,
              writer: { kind: 'owner' as const },
            };
            const trace: string[] = [];
            const readbacks: unknown[] = [];
            const started = yield* Deferred.make<void>();
            let hold = false;
            const comments: CommentStore = {
              ...nativeComments,
              find: (key) =>
                Effect.gen(function* () {
                  if (hold) {
                    yield* Deferred.succeed(started, undefined);
                    return yield* Effect.never;
                  }
                  return yield* nativeComments.find(key);
                }),
            };
            const readback = () =>
              Effect.gen(function* () {
                readbacks.push({
                  threads: yield* nativeComments.list({
                    reviewId: review.reviewId,
                  }),
                  marks: yield* marks.list({ reviewId: review.reviewId }),
                  review: yield* reviews.readRecord({
                    reviewId: review.reviewId,
                  }),
                });
              });
            const publish = (event: string) =>
              Effect.andThen(
                Effect.sync(() => trace.push(event)),
                readback(),
              );
            const events: EventPublisher = {
              inventoryChanged: () => publish('inventory'),
              worktreeChanged: () => publish('comments'),
              filesChanged: () => Effect.void,
              projectChanged: () => Effect.void,
              gitActionProgressed: () => Effect.void,
              gitActionChanged: () => Effect.void,
            };
            const listener = (event: unknown) => {
              const entry = record(event);
              if (entry.phase === 'settled') trace.push('settled');
            };
            yield* Effect.acquireRelease(
              Effect.sync(() => operations.subscribe(listener)),
              () => Effect.sync(() => operations.unsubscribe(listener)),
            );
            const unused = () =>
              Effect.die(
                new Error(
                  'This durable review operation must not access a worktree',
                ),
              );
            const base = Layer.mergeAll(
              Layer.succeed(CommentStore, comments),
              Layer.succeed(ReviewStore, reviews),
              Layer.succeed(ReviewedLayerStore, marks),
              Layer.succeed(IdSource, { next: randomUUID }),
              Layer.succeed(
                CreateCommentThreadOptions,
                LIMITS.reviews.comments,
              ),
              Layer.succeed(ReplyToCommentOptions, LIMITS.reviews.comments),
              Layer.succeed(EditCommentMessageOptions, LIMITS.reviews.comments),
              Layer.succeed(EventPublisher, events),
              Layer.succeed(BranchReviewReader, {
                read: unused,
                byWorktrees: unused,
              }),
              Layer.succeed(ReviewCodeReader, { readText: unused }),
              Layer.succeed(CheckWorktreeUseCasePort, { execute: unused }),
              Layer.succeed(WorktreeConsistencyProbe, { execute: unused }),
              Layer.succeed(LaneOptions, {
                deadlineMs: 10000,
                readCapacity: 2,
                consistency: { execute: unused },
              }),
              Layer.succeed(
                ReviewedFileStore,
                Context.get(storage, ReviewedFileStore),
              ),
              LaneKeys.layer,
            );
            const lanesLayer = Lanes.layer.pipe(Layer.provideMerge(base));
            const runtime = WorktreeAccess.layer.pipe(
              Layer.provideMerge(lanesLayer),
            );
            const services = Layer.mergeAll(
              CreateCommentThreadService.layer,
              ReplyToCommentService.layer,
              UpdateCommentThreadService.layer,
              EditCommentMessageService.layer,
              DeleteResolvedCommentsService.layer,
              ReadReviewRevisionService.layer,
              SetReviewMarkService.layer,
              RemoveReviewMarkService.layer,
              DeleteReviewService.layer,
              ReadPublishedReviewService.layer,
            ).pipe(Layer.provideMerge(runtime));
            const context = yield* Layer.build(
              Layer.mergeAll(
                CreateCommentThreadUseCase.layer,
                ReplyToCommentUseCase.layer,
                UpdateCommentThreadUseCase.layer,
                EditCommentMessageUseCase.layer,
                DeleteResolvedCommentsUseCase.layer,
                SetReviewMarkUseCase.layer,
                RemoveReviewMarkUseCase.layer,
                DeleteReviewUseCase.layer,
              ).pipe(Layer.provideMerge(services)),
            );
            const create = Context.get(context, CreateCommentThreadUseCase);
            const reply = Context.get(context, ReplyToCommentUseCase);
            const resolve = Context.get(context, UpdateCommentThreadUseCase);
            const creation = {
              ...input,
              threadId: randomUUID(),
              messageId: randomUUID(),
              anchor: { kind: 'change' as const },
              body: 'First',
            };
            const thread = yield* create.execute(creation);
            const replyInput = {
              ...input,
              threadId: thread.id,
              messageId: randomUUID(),
              body: 'Reply',
            };
            if (state === 'replay reply') yield* reply.execute(replyInput);
            if (state === 'reopen' || state === 'delete resolved')
              yield* resolve.execute({
                ...input,
                threadId: thread.id,
                resolved: true,
              });
            const decision = review.layers[0];
            if (decision === undefined)
              return yield* Effect.die(
                new Error('Fixture must include a decision'),
              );
            const mark = {
              reviewId: review.reviewId,
              kind: 'decision' as const,
              layerId: decision.id,
              fingerprint: decision.fingerprint,
            };
            const setMark = Context.get(context, SetReviewMarkUseCase);
            if (state === 'remove decision mark')
              yield* setMark.execute({ ...mark, revision: 1 });
            trace.length = 0;
            readbacks.length = 0;
            switch (state) {
              case 'create':
                yield* create.execute({
                  ...creation,
                  threadId: randomUUID(),
                  messageId: randomUUID(),
                });
                break;
              case 'replay thread':
                yield* create.execute(creation);
                break;
              case 'reply':
              case 'replay reply':
                yield* reply.execute(replyInput);
                break;
              case 'resolve':
              case 'reopen':
              case 'unchanged resolution':
                yield* resolve.execute({
                  ...input,
                  threadId: thread.id,
                  resolved: state === 'resolve',
                });
                break;
              case 'unchanged edit':
                yield* Context.get(context, EditCommentMessageUseCase).execute({
                  ...input,
                  threadId: thread.id,
                  messageId: creation.messageId,
                  body: 'First',
                });
                break;
              case 'empty deletion':
              case 'delete resolved': {
                const current = yield* nativeComments.find({
                  threadId: thread.id,
                });
                yield* Context.get(
                  context,
                  DeleteResolvedCommentsUseCase,
                ).execute({
                  ...input,
                  threads: [
                    { threadId: thread.id, revision: current?.revision ?? 0 },
                  ],
                });
                break;
              }
              case 'set decision mark':
                yield* setMark.execute({ ...mark, revision: 1 });
                break;
              case 'remove decision mark':
                yield* Context.get(context, RemoveReviewMarkUseCase).execute(
                  mark,
                );
                break;
              case 'delete review':
                yield* Context.get(context, DeleteReviewUseCase).execute(input);
                break;
              case 'failure': {
                const result = yield* reply
                  .execute({ ...replyInput, threadId: randomUUID() })
                  .pipe(Effect.exit);
                expect(result._tag).toBe('Failure');
                break;
              }
              case 'interruption': {
                hold = true;
                const fiber = yield* Effect.forkChild(
                  reply.execute(replyInput),
                );
                yield* Deferred.await(started);
                yield* Fiber.interrupt(fiber);
                yield* Context.get(
                  yield* Layer.build(lanesLayer),
                  Lanes,
                ).close();
                break;
              }
              case 'back to back':
                yield* reply.execute(replyInput);
                yield* resolve.execute({
                  ...input,
                  threadId: thread.id,
                  resolved: true,
                });
                break;
            }
            expect(trace).toEqual(expected);
            expect(readbacks).toHaveLength(
              expected.filter((value) => value !== 'settled').length,
            );
            if (state === 'failure' || state === 'interruption') return;
            for (const value of readbacks) {
              expect(value).toMatchObject(
                state === 'delete review'
                  ? { review: undefined }
                  : { review: { reviewId: review.reviewId } },
              );
            }
            const last = readbacks.at(-1);
            if (state === 'resolve' || state === 'back to back')
              expect(last).toMatchObject({ threads: [{ resolved: true }] });
            if (
              state === 'reply' ||
              state === 'replay reply' ||
              state === 'back to back'
            )
              expect(last).toMatchObject({
                threads: [{ messages: [{ body: 'First' }, { body: 'Reply' }] }],
              });
            if (state === 'set decision mark')
              expect(last).toMatchObject({
                marks: [
                  { layerId: decision.id, fingerprint: decision.fingerprint },
                ],
              });
            if (state === 'remove decision mark')
              expect(last).toMatchObject({ marks: [] });
            if (state === 'delete resolved')
              expect(last).toMatchObject({ threads: [] });
          }),
        ).pipe(Effect.provide(NodeServices.layer)),
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  },
);
