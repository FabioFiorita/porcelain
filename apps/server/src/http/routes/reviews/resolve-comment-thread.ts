import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  resolveCommentThreadRequestSchema,
  resolveCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { ResolveCommentThreadUseCase } from '../../../use-cases/reviews/resolve-comment-thread.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function resolveCommentThread(
  server: FastifyInstance,
  options: { useCase: Pick<ResolveCommentThreadUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/comments/:threadId/resolution',
    {
      schema: {
        params: commentThreadParamsSchema,
        body: resolveCommentThreadRequestSchema,
        response: {
          ...errorResponses,
          200: resolveCommentThreadResponseSchema,
        },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
