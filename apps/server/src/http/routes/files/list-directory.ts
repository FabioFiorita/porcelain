import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  directoryResponseSchema,
  fileQuerySchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { ListDirectoryController } from '../../../controllers/list-directory-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listDirectory(
  server: FastifyInstance,
  options: { controller: Pick<ListDirectoryController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/directory',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: fileQuerySchema,
        response: { ...errorResponses, 200: directoryResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
