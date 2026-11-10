import { randomUUID } from 'node:crypto';
import { Effect, Schema } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { storageLayer } from '@porcelain/storage';
import { CommentStore, ReviewStore } from '@porcelain/reviews/ports';
import { commentStorageSize } from '@porcelain/reviews/rules';
import type { CommentAnchor, CommentMessage } from '@porcelain/reviews/models';
import { createCommentThreadResponseSchema } from '@porcelain/contracts/reviews';
import type { Session } from './session.ts';

type AgentMessage = {
  body: string;
  messageId?: string | undefined;
  reviewId?: string | undefined;
};

export async function seedAgentComment(
  session: Session,
  input: AgentMessage & {
    threadId?: string | undefined;
    anchor: CommentAnchor;
  },
) {
  return seedAgentMessage(session, { ...input, kind: 'thread' });
}

export async function seedAgentReply(
  session: Session,
  input: AgentMessage & { threadId: string },
) {
  return seedAgentMessage(session, { ...input, kind: 'reply' });
}

async function seedAgentMessage(
  session: Session,
  input:
    | (AgentMessage & {
        kind: 'thread';
        threadId?: string | undefined;
        anchor: CommentAnchor;
      })
    | (AgentMessage & { kind: 'reply'; threadId: string }),
) {
  const stored = await Effect.runPromise(
    Effect.gen(function* () {
      const comments = yield* CommentStore;
      const reviews = yield* ReviewStore;
      const message: CommentMessage = {
        id: input.messageId ?? randomUUID(),
        body: input.body,
        author: 'agent',
        createdAt: '2026-11-10T00:00:00.000Z',
      };
      let thread;
      if (input.kind === 'reply') {
        const current = yield* comments.find({ threadId: input.threadId });
        if (!current)
          throw new Error('Agent reply fixture requires an existing thread');
        thread = yield* comments.append({
          thread: current,
          message,
          sizeBytes: commentStorageSize({
            ...current,
            messages: [...current.messages, message],
          }),
          writtenByAgent: true,
        });
      } else {
        const review = input.reviewId
          ? yield* reviews.read({ reviewId: input.reviewId })
          : undefined;
        const content = {
          id: input.threadId ?? randomUUID(),
          worktreeId: session.worktreeId,
          anchor: input.anchor,
          messages: [message],
          ...(review
            ? {
                review: {
                  reviewId: review.reviewId,
                  revision: review.revision,
                  headOid: review.headOid,
                },
              }
            : {}),
        };
        thread = yield* comments.insert({
          content,
          sizeBytes: commentStorageSize(content),
          writtenByAgent: true,
        });
      }
      yield* comments.resolve({ thread, resolved: !thread.resolved });
      return thread;
    }).pipe(
      Effect.provide(
        storageLayer(session.dataDirectory, {
          worktreeIdLength: 12,
          busyTimeoutMs: 5000,
        }),
      ),
      Effect.provide(NodeServices.layer),
    ),
  );
  const path = stored.review
    ? `/api/reviews/${stored.review.reviewId}/comments/${stored.id}`
    : `/api/worktrees/${session.worktreeId}/comments/${stored.id}/resolution`;
  const response = await session.read({
    method: 'PUT',
    path,
    body: { resolved: stored.resolved },
  });
  return Schema.decodeUnknownSync(createCommentThreadResponseSchema)(
    response.body,
  );
}
