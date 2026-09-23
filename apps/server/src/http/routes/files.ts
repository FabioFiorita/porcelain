import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  worktreeParamsSchema,
  worktreePathsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';
import { editFile } from './edit-file.ts';
import { listDirectory } from './list-directory.ts';
import { readPreviewAssets } from './read-preview-assets.ts';
import { readTextFile } from './read-text-file.ts';
export async function fileRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options));
  listDirectory(server, options);
  readTextFile(server, options);
  readPreviewAssets(server, options);
  editFile(server, options);
  server.withTypeProvider<ZodTypeProvider>().get(
    '/worktrees/:worktreeId/paths',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: worktreePathsSchema },
      },
    },
    (request) =>
      options.application.worktreePaths(
        request.params.worktreeId,
        request.disconnected,
      ),
  );
}
