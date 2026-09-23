import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitStatusResponseSchema,
  gitWorktreeParamsSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ReadGitStatusController } from '../../../controllers/read-git-status-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readGitStatus(
  server: FastifyInstance,
  options: { controller: Pick<ReadGitStatusController, 'execute'> },
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
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
