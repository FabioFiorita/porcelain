import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitStatusResponseSchema,
  gitWorktreeParamsSchema,
} from '@porcelain/contracts/git-status';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toGitStatusResponse } from '../mappers/git-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function readGitStatus(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
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
}
