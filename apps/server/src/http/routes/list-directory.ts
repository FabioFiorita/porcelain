import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  directoryResponseSchema,
  fileQuerySchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toDirectoryResponse } from '../mappers/file-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function listDirectory(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/directory',
    {
      schema: {
        tags: ['Files'],
        summary: 'List a directory in a worktree',
        params: worktreeParamsSchema,
        querystring: fileQuerySchema,
        response: { ...errorResponses, 200: directoryResponseSchema },
      },
    },
    async (request) =>
      toDirectoryResponse(
        await options.application.listDirectory(
          request.params.worktreeId,
          request.query.path,
        ),
      ),
  );
}
