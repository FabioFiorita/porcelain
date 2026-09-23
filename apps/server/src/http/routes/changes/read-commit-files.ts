import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitFilesParamsSchema,
  commitFilesQuerySchema,
  commitFilesResponseSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ReadCommitFilesController } from '../../../controllers/read-commit-files-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readCommitFiles(
  server: FastifyInstance,
  options: { controller: Pick<ReadCommitFilesController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/commits/:oid/files',
    {
      schema: {
        params: commitFilesParamsSchema,
        querystring: commitFilesQuerySchema,
        response: { ...errorResponses, 200: commitFilesResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
