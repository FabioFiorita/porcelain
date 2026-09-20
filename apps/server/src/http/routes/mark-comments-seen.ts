import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentScopeSchema,
  seenCommentsRequestSchema,
  seenCommentsResponseSchema,
} from '@porcelain/contracts/comments';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function markCommentsSeen(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/comments/seen',
    {
      schema: {
        params: commentScopeSchema,
        body: seenCommentsRequestSchema,
        response: { ...errorResponses, 200: seenCommentsResponseSchema },
      },
    },
    // The reader says what it displayed, not "everything until now": a reply
    // written while the page was open must not be acknowledged unseen.
    async (request) =>
      options.application.markCommentsSeen(
        request.params.worktreeId,
        request.body.throughRevision,
        request.disconnected,
      ),
  );
}
