import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  setFilePreferenceParamsSchema,
  setFilePreferenceRequestSchema,
  setFilePreferenceResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { SetFilePreferenceUseCase } from '../../../use-cases/projects/set-file-preference.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setFilePreference(
  server: FastifyInstance,
  options: { useCase: Pick<SetFilePreferenceUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/projects/:projectId/file-preferences',
    {
      schema: {
        params: setFilePreferenceParamsSchema,
        body: setFilePreferenceRequestSchema,
        response: { ...errorResponses, 200: setFilePreferenceResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
