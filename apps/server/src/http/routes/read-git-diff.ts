import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitDiffRequestSchema,
  gitDiffResponseSchema,
} from '@porcelain/contracts/git-diff';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/git-status';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toGitDiffResponse } from '../mappers/git-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function readGitDiff(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
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
