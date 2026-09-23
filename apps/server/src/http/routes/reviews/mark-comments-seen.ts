import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  markCommentsSeenRequestSchema,
  markCommentsSeenResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
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
        params: worktreeParamsSchema,
        body: markCommentsSeenRequestSchema,
        response: { ...errorResponses, 200: markCommentsSeenResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
