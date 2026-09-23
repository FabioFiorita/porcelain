import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  fileQuerySchema,
  textResponseSchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
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
        querystring: fileQuerySchema,
        response: { ...errorResponses, 200: textResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
