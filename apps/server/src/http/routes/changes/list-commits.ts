import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  listCommitsQuerySchema,
  listCommitsResponseSchema,
} from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
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
        params: worktreeParamsSchema,
        querystring: listCommitsQuerySchema,
        response: { ...errorResponses, 200: listCommitsResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
