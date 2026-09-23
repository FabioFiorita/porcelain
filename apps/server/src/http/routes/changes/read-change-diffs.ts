import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readChangeDiffsRequestSchema,
  readChangeDiffsResponseSchema,
} from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
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
        params: worktreeParamsSchema,
        body: readChangeDiffsRequestSchema,
        response: { ...errorResponses, 200: readChangeDiffsResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
