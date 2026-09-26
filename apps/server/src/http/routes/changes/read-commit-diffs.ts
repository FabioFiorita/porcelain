import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readCommitDiffsParamsSchema,
  readCommitDiffsRequestSchema,
  readCommitDiffsResponseSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ReadCommitDiffsUseCase } from '../../../use-cases/changes/read-commit-diffs.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readCommitDiffs(
  server: FastifyInstance,
  options: { useCase: Pick<ReadCommitDiffsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/commits/:oid/diffs',
    {
      schema: {
        params: readCommitDiffsParamsSchema,
        body: readCommitDiffsRequestSchema,
        response: { ...errorResponses, 200: readCommitDiffsResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
