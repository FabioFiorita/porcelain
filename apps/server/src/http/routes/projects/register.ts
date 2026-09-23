import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  absoluteRegisterProjectRequestSchema,
  projectResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { RegisterProjectController } from '../../../controllers/register-project-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function registerProject(
  server: FastifyInstance,
  options: { controller: Pick<RegisterProjectController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/projects',
    {
      schema: {
        body: absoluteRegisterProjectRequestSchema,
        response: { ...errorResponses, 200: projectResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
