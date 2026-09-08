import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  filePreferenceScopeSchema,
  filePreferencesResponseSchema,
  setFilePreferenceRequestSchema,
} from '@porcelain/contracts/file-preferences';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function setFilePreference(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/file-preferences',
    {
      schema: {
        params: filePreferenceScopeSchema,
        body: setFilePreferenceRequestSchema,
        response: { ...errorResponses, 200: filePreferencesResponseSchema },
      },
    },
    async (request) => ({
      preferences: await options.application.setFilePreference(
        request.params.worktreeId,
        request.body,
      ),
    }),
  );
}
