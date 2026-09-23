import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentScopeSchema,
  seenCommentsRequestSchema,
  seenCommentsResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { MarkCommentsSeenController } from '../../../controllers/mark-comments-seen-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function markCommentsSeen(
  server: FastifyInstance,
  options: { controller: Pick<MarkCommentsSeenController, 'execute'> },
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
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
