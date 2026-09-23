import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitDiffsRequestSchema,
  commitDiffsResponseSchema,
  commitFilesParamsSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ReadCommitDiffsController } from '../../../controllers/read-commit-diffs-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readCommitDiffs(
  server: FastifyInstance,
  options: { controller: Pick<ReadCommitDiffsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/commits/:oid/diffs',
    {
      schema: {
        params: commitFilesParamsSchema,
        body: commitDiffsRequestSchema,
        response: { ...errorResponses, 200: commitDiffsResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
