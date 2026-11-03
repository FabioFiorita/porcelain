import { Effect, Layer, Schema } from 'effect';
import { captureGitPlatform, listWorktrees } from '@porcelain/git/discovery';
import { captureT3Session } from '@porcelain/agents/feedback';
import { AgentFeedbackConflictError } from '@porcelain/reviews/errors';
import { ReviewAgentHost } from '@porcelain/reviews/ports';
import type { Limits } from '../../config/limits.ts';

const targetSchema = Schema.Struct({
  thread: Schema.Struct({
    threadId: Schema.String,
    worktreePath: Schema.NullOr(Schema.String),
    archived: Schema.Boolean,
    pendingRequestCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
});

const projectThreadsSchema = Schema.Array(
  Schema.Struct({ threadId: Schema.String }),
);

const receiptSchema = Schema.Struct({
  threadId: Schema.String,
  runId: Schema.NonEmptyString,
  messageId: Schema.NonEmptyString,
  delivery: Schema.Literals(['started', 'queued']),
});

export const t3ReviewAgentHostLayer = (limits: Limits['git']) =>
  Layer.effect(
    ReviewAgentHost,
    Effect.gen(function* () {
      const command = yield* captureT3Session();
      const git = yield* captureGitPlatform();
      return ReviewAgentHost.of({
        execute: Effect.fn('ReviewAgentHost.execute')(function* (input) {
          const target = yield* command({
            threadId: input.session.threadId,
            operation: { kind: 'read' },
            timeoutMs: limits.readTimeoutMs,
            maxBytes: limits.outputBytes,
            processGroup: limits.processGroup,
          }).pipe(
            Effect.flatMap(
              Schema.decodeUnknownEffect(Schema.fromJsonString(targetSchema)),
            ),
            Effect.mapError(
              () =>
                new AgentFeedbackConflictError({
                  reviewId: input.reviewId,
                  reason: 'recipient-unavailable',
                }),
            ),
          );
          if (
            target.thread.threadId !== input.session.threadId ||
            (target.thread.worktreePath !== null &&
              target.thread.worktreePath !== input.worktreePath)
          )
            return yield* new AgentFeedbackConflictError({
              reviewId: input.reviewId,
              reason: 'recipient-mismatch',
            });
          if (target.thread.worktreePath === null) {
            const members = yield* git(
              listWorktrees(input.worktreePath, limits),
            ).pipe(
              Effect.flatMap(
                Effect.fn(function* (repository) {
                  const main = repository.worktrees.find(
                    (worktree) => worktree.main,
                  );
                  if (main === undefined)
                    return yield* new AgentFeedbackConflictError({
                      reviewId: input.reviewId,
                      reason: 'recipient-mismatch',
                    });
                  return yield* command({
                    threadId: input.session.threadId,
                    operation: { kind: 'project-threads', path: main.path },
                    timeoutMs: limits.readTimeoutMs,
                    maxBytes: limits.outputBytes,
                    processGroup: limits.processGroup,
                  });
                }),
              ),
              Effect.flatMap(
                Schema.decodeUnknownEffect(
                  Schema.fromJsonString(projectThreadsSchema),
                ),
              ),
              Effect.mapError(
                () =>
                  new AgentFeedbackConflictError({
                    reviewId: input.reviewId,
                    reason: 'recipient-mismatch',
                  }),
              ),
            );
            if (
              !members.some(
                (member) => member.threadId === input.session.threadId,
              )
            )
              return yield* new AgentFeedbackConflictError({
                reviewId: input.reviewId,
                reason: 'recipient-mismatch',
              });
          }
          if (target.thread.archived || target.thread.pendingRequestCount > 0)
            return yield* new AgentFeedbackConflictError({
              reviewId: input.reviewId,
              reason: 'recipient-unavailable',
            });
          if (input.kind === 'verify') return;
          const receipt = yield* command({
            threadId: input.session.threadId,
            operation: { kind: 'send', message: input.message },
            timeoutMs: limits.readTimeoutMs,
            maxBytes: limits.outputBytes,
            processGroup: limits.processGroup,
          }).pipe(
            Effect.flatMap(
              Schema.decodeUnknownEffect(Schema.fromJsonString(receiptSchema)),
            ),
            Effect.mapError(
              () =>
                new AgentFeedbackConflictError({
                  reviewId: input.reviewId,
                  reason: 'recipient-unavailable',
                }),
            ),
          );
          if (receipt.threadId !== input.session.threadId)
            return yield* new AgentFeedbackConflictError({
              reviewId: input.reviewId,
              reason: 'recipient-mismatch',
            });
        }),
      });
    }),
  );
