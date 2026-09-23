import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  projectParamsSchema,
  setFilePreferenceRequestSchema,
  setFilePreferenceResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { SetFilePreferenceController } from '../../../controllers/set-file-preference-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setFilePreference(
  server: FastifyInstance,
  options: { controller: Pick<SetFilePreferenceController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/projects/:projectId/file-preferences',
    {
      schema: {
        params: projectParamsSchema,
        body: setFilePreferenceRequestSchema,
        response: { ...errorResponses, 200: setFilePreferenceResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute({ ...request.params, ...request.body }),
  );
}
