import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  projectDeletionSchema,
  projectParamsSchema,
} from '@porcelain/contracts/inventory';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function removeProject(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/projects/:projectId',
    {
      schema: {
        params: projectParamsSchema,
        response: { ...errorResponses, 200: projectDeletionSchema },
      },
    },
    async (request) =>
      options.application.removeProject(request.params.projectId),
  );
}
