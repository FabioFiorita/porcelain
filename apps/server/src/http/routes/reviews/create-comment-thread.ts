import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  createCommentThreadRequestSchema,
  createCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { CreateCommentThreadController } from '../../../controllers/create-comment-thread-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function createCommentThread(
  server: FastifyInstance,
  options: { controller: Pick<CreateCommentThreadController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/comments',
    {
      schema: {
        params: worktreeParamsSchema,
        body: createCommentThreadRequestSchema,
        response: { ...errorResponses, 200: createCommentThreadResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body, writer: request.principal },
        { signal: request.disconnected },
      ),
  );
}
