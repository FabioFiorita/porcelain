import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  projectNameResponseSchema,
  projectParamsSchema,
  renameProjectRequestSchema,
} from '@porcelain/contracts/inventory';
import type { FastifyInstance } from 'fastify';
import type { RenameProjectController } from '../../controllers/rename-project-controller.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function renameProject(
  server: FastifyInstance,
  options: { projects: Pick<RenameProjectController, 'rename'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.patch(
    '/projects/:projectId',
    {
      schema: {
        params: projectParamsSchema,
        body: renameProjectRequestSchema,
        response: { ...errorResponses, 200: projectNameResponseSchema },
      },
    },
    async (request) =>
      options.projects.rename(
        request.params.projectId,
        request.body.name,
        request.disconnected,
      ),
  );
}
