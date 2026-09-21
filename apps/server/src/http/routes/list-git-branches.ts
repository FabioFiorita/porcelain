import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  branchesResponseSchema,
  gitActionScopeSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function listGitBranches(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().get(
    '/projects/:projectId/worktrees/:worktreeId/git/branches',
    {
      schema: {
        params: gitActionScopeSchema,
        response: { ...errorResponses, 200: branchesResponseSchema },
      },
    },
    (request) =>
      options.application.gitBranches(request.params, request.disconnected),
  );
}
