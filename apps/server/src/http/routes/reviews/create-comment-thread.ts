import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  createCommentThreadRequestSchema,
  createCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { CreateCommentThreadUseCase } from '../../../use-cases/reviews/create-comment-thread.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function createCommentThread(
  server: FastifyInstance,
  options: { useCase: Pick<CreateCommentThreadUseCase, 'execute'> },
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
      options.useCase.execute(
        { ...request.params, ...request.body, writer: request.principal },
        { signal: request.disconnected },
      ),
  );
}
