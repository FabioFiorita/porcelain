import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  listDirectoryQuerySchema,
  listDirectoryResponseSchema,
} from '@porcelain/contracts/files';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ListDirectoryUseCase } from '../../../use-cases/files/list-directory.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listDirectory(
  server: FastifyInstance,
  options: { useCase: Pick<ListDirectoryUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/directory',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: listDirectoryQuerySchema,
        response: { ...errorResponses, 200: listDirectoryResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
