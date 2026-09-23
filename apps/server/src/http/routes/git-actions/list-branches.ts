import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionScopeSchema,
  listGitBranchesResponseSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { ListGitBranchesController } from '../../../controllers/list-git-branches-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listBranches(
  server: FastifyInstance,
  options: { controller: Pick<ListGitBranchesController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/projects/:projectId/worktrees/:worktreeId/git/branches',
    {
      schema: {
        params: gitActionScopeSchema,
        response: { ...errorResponses, 200: listGitBranchesResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
