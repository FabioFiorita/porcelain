import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  browseProjectFoldersQuerySchema,
  browseProjectFoldersResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { BrowseProjectFoldersController } from '../../../controllers/browse-project-folders-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function browseProjectFolders(
  server: FastifyInstance,
  options: { controller: Pick<BrowseProjectFoldersController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/projects/folders',
    {
      schema: {
        querystring: browseProjectFoldersQuerySchema,
        response: {
          ...errorResponses,
          200: browseProjectFoldersResponseSchema,
        },
      },
    },
    async (request) =>
      options.controller.execute(request.query, {
        signal: request.disconnected,
      }),
  );
}
