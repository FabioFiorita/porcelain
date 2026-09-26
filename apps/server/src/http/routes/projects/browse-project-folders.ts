import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  browseProjectFoldersQuerySchema,
  browseProjectFoldersResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { BrowseProjectFoldersUseCase } from '../../../use-cases/projects/browse-project-folders.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function browseProjectFolders(
  server: FastifyInstance,
  options: { useCase: Pick<BrowseProjectFoldersUseCase, 'execute'> },
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
      options.useCase.execute(request.query, {
        signal: request.disconnected,
      }),
  );
}
