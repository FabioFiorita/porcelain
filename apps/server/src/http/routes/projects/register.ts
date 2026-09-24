import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  registerProjectRequestSchema,
  registerProjectResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { RegisterProjectUseCase } from '../../../use-cases/projects/register-project.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function registerProject(
  server: FastifyInstance,
  options: { useCase: Pick<RegisterProjectUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/projects',
    {
      schema: {
        body: registerProjectRequestSchema,
        response: { ...errorResponses, 200: registerProjectResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
