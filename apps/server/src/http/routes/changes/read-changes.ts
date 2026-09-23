import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  changesResponseSchema,
  gitWorktreeParamsSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ReadChangesController } from '../../../controllers/read-changes-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readChanges(
  server: FastifyInstance,
  options: { controller: Pick<ReadChangesController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/changes',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: changesResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
