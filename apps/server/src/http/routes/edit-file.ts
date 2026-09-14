import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  fileEditResultSchema,
  fileEditSchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function editFile(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/worktrees/:worktreeId/files',
    {
      schema: {
        params: worktreeParamsSchema,
        body: fileEditSchema,
        response: { ...errorResponses, 200: fileEditResultSchema },
      },
      bodyLimit: 8 * 1024 * 1024,
    },
    (request) =>
      options.application.editFile(request.params.worktreeId, request.body),
  );
}
