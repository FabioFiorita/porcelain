import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  removeProjectParamsSchema,
  removeProjectResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { RemoveProjectUseCase } from '../../../use-cases/projects/remove-project.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function removeProject(
  server: FastifyInstance,
  options: { useCase: Pick<RemoveProjectUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/projects/:projectId',
    {
      schema: {
        params: removeProjectParamsSchema,
        response: { ...errorResponses, 200: removeProjectResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
