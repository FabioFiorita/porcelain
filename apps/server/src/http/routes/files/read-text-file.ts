import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readTextFileQuerySchema,
  readTextFileResponseSchema,
} from '@porcelain/contracts/files';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadTextFileController } from '../../../controllers/read-text-file-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readTextFile(
  server: FastifyInstance,
  options: { controller: Pick<ReadTextFileController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/text',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: readTextFileQuerySchema,
        response: { ...errorResponses, 200: readTextFileResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
