import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitPageQuerySchema,
  commitPageResponseSchema,
  historyParamsSchema,
} from '@porcelain/contracts/commit-history';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toCommitPageResponse } from '../mappers/history-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function listCommits(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/commits',
    {
      schema: {
        tags: ['History'],
        summary: 'List commits or a file timeline',
        params: historyParamsSchema,
        querystring: commitPageQuerySchema,
        response: { ...errorResponses, 200: commitPageResponseSchema },
      },
    },
    async (request) =>
      toCommitPageResponse(
        await options.application.listCommits(request.params.worktreeId, {
          ...(request.query.limit !== undefined
            ? { limit: request.query.limit }
            : {}),
          ...(request.query.cursor !== undefined
            ? { cursor: request.query.cursor }
            : {}),
        }),
      ),
  );
}
