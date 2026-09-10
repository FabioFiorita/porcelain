import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  fileQuerySchema,
  textResponseSchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toTextResponse } from '../mappers/file-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function readTextFile(
  server: FastifyInstance,
  options: { application: Application },
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
      toTextResponse(
        await options.application.readTextFile(
          request.params.worktreeId,
          request.query.path,
        ),
      ),
  );
}
