import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  renameProjectParamsSchema,
  renameProjectRequestSchema,
  renameProjectResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { RenameProjectController } from '../../../controllers/rename-project-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function renameProject(
  server: FastifyInstance,
  options: { controller: Pick<RenameProjectController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.patch(
    '/projects/:projectId',
    {
      schema: {
        params: renameProjectParamsSchema,
        body: renameProjectRequestSchema,
        response: { ...errorResponses, 200: renameProjectResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
