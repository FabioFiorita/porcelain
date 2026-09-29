import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listBranchBasesResponseSchema } from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ListBranchBasesUseCase } from '../../../use-cases/changes/list-branch-bases.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listBranchBases(
  server: FastifyInstance,
  options: { useCase: Pick<ListBranchBasesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/branch-bases',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: listBranchBasesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
