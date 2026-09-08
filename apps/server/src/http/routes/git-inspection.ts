import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitDiffRequestSchema,
  gitDiffResponseSchema,
} from '@porcelain/contracts/git-diff';
import {
  gitStatusResponseSchema,
  gitWorktreeParamsSchema,
} from '@porcelain/contracts/git-status';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import {
  toGitDiffResponse,
  toGitStatusResponse,
} from '../mappers/git-response.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function gitInspectionRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  const typed = server.withTypeProvider<ZodTypeProvider>();
  typed.get(
    '/worktrees/:worktreeId/git/status',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: gitStatusResponseSchema },
      },
    },
    async (request) =>
      toGitStatusResponse(
        await options.application.gitStatus(request.params.worktreeId),
      ),
  );
  typed.post(
    '/worktrees/:worktreeId/git/diff',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        body: gitDiffRequestSchema,
        response: { ...errorResponses, 200: gitDiffResponseSchema },
      },
    },
    async (request) =>
      toGitDiffResponse(
        await options.application.gitDiff(
          request.params.worktreeId,
          request.body.expectedStatusToken,
          request.body.change,
        ),
      ),
  );
}
