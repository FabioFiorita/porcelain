import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitPageQuerySchema,
  commitPageResponseSchema,
  historyParamsSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ListCommitsController } from '../../../controllers/list-commits-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listCommits(
  server: FastifyInstance,
  options: { controller: Pick<ListCommitsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/commits',
    {
      schema: {
        params: historyParamsSchema,
        querystring: commitPageQuerySchema,
        response: { ...errorResponses, 200: commitPageResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
