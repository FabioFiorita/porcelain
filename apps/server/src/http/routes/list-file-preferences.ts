import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  filePreferenceScopeSchema,
  filePreferencesResponseSchema,
} from '@porcelain/contracts/file-preferences';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function listFilePreferences(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/projects/:projectId/file-preferences',
    {
      schema: {
        tags: ['File preferences'],
        summary: 'List pinned and hidden paths',
        params: filePreferenceScopeSchema,
        response: { ...errorResponses, 200: filePreferencesResponseSchema },
      },
    },
    async (request) => ({
      preferences: await options.application.listFilePreferences(
        request.params.projectId,
      ),
    }),
  );
}
