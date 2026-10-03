import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  listFileCommitsQuerySchema,
  listFileCommitsResponseSchema,
} from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ListFileCommitsUseCase } from '../../../use-cases/changes/list-file-commits.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listFileCommits(
  server: FastifyInstance,
  options: { useCase: Pick<ListFileCommitsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/file-commits',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: listFileCommitsQuerySchema,
        response: { ...errorResponses, 200: listFileCommitsResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
