import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readCommitFilesParamsSchema,
  readCommitFilesQuerySchema,
  readCommitFilesResponseSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ReadCommitFilesUseCase } from '../../../use-cases/changes/read-commit-files.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readCommitFiles(
  server: FastifyInstance,
  options: { useCase: Pick<ReadCommitFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/commits/:oid/files',
    {
      schema: {
        params: readCommitFilesParamsSchema,
        querystring: readCommitFilesQuerySchema,
        response: { ...errorResponses, 200: readCommitFilesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
