import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  changeLinesQuerySchema,
  changeLinesResponseSchema,
  gitWorktreeParamsSchema,
} from '@porcelain/contracts/changes';
import type { FastifyInstance } from 'fastify';
import type { ReadChangeLinesController } from '../../../controllers/read-change-lines-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readChangeLines(
  server: FastifyInstance,
  options: { controller: Pick<ReadChangeLinesController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/changes/lines',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        querystring: changeLinesQuerySchema,
        response: { ...errorResponses, 200: changeLinesResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
