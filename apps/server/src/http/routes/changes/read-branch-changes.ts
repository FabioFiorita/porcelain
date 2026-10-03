import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readBranchChangesQuerySchema,
  readBranchChangesResponseSchema,
} from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadBranchChangesUseCase } from '../../../use-cases/changes/read-branch-changes.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readBranchChanges(
  server: FastifyInstance,
  options: { useCase: Pick<ReadBranchChangesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/branch-changes',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: readBranchChangesQuerySchema,
        response: { ...errorResponses, 200: readBranchChangesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
