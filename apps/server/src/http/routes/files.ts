import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  fileTreeSchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';
import { editFile } from './edit-file.ts';
import { listDirectory } from './list-directory.ts';
import { readTextFile } from './read-text-file.ts';
export async function fileRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options));
  listDirectory(server, options);
  readTextFile(server, options);
  editFile(server, options);
  server.withTypeProvider<ZodTypeProvider>().get(
    '/worktrees/:worktreeId/file-tree',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: fileTreeSchema },
      },
    },
    (request) =>
      options.application.fileTree(
        request.params.worktreeId,
        request.disconnected,
      ),
  );
}
