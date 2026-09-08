import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  directoryResponseSchema,
  fileQuerySchema,
  textResponseSchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import {
  toDirectoryResponse,
  toTextResponse,
} from '../mappers/file-response.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';
export async function fileRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  const typed = server.withTypeProvider<ZodTypeProvider>();
  typed.get(
    '/worktrees/:worktreeId/directory',
    {
      schema: {
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
  typed.get(
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
