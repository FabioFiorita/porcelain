import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readBranchDiffsRequestSchema,
  readBranchDiffsResponseSchema,
} from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadBranchDiffsUseCase } from '../../../use-cases/changes/read-branch-diffs.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readBranchDiffs(
  server: FastifyInstance,
  options: { useCase: Pick<ReadBranchDiffsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/branch-changes/diffs',
    {
      schema: {
        params: worktreeParamsSchema,
        body: readBranchDiffsRequestSchema,
        response: { ...errorResponses, 200: readBranchDiffsResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
