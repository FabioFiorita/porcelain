import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  markCommentsSeenRequestSchema,
  markCommentsSeenResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { MarkCommentsSeenUseCase } from '../../../use-cases/reviews/mark-comments-seen.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function markCommentsSeen(
  server: FastifyInstance,
  options: { useCase: Pick<MarkCommentsSeenUseCase, 'execute'> },
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
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
