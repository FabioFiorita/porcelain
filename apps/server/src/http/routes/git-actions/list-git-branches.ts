import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionScopeSchema,
  listGitBranchesResponseSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { ListGitBranchesUseCase } from '../../../use-cases/git-actions/list-git-branches.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listGitBranches(
  server: FastifyInstance,
  options: { useCase: Pick<ListGitBranchesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/git/branches',
    {
      schema: {
        params: gitActionScopeSchema,
        response: { ...errorResponses, 200: listGitBranchesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
