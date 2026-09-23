import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  changeDiffsRequestSchema,
  changeDiffsResponseSchema,
  gitWorktreeParamsSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ReadChangeDiffsController } from '../../../controllers/read-change-diffs-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readChangeDiffs(
  server: FastifyInstance,
  options: { controller: Pick<ReadChangeDiffsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/changes/diffs',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        body: changeDiffsRequestSchema,
        response: { ...errorResponses, 200: changeDiffsResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
