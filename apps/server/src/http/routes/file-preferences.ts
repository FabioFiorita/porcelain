import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  filePreferenceScopeSchema,
  filePreferencesResponseSchema,
  setFilePreferenceRequestSchema,
} from '@porcelain/contracts/file-preferences';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function filePreferenceRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/file-preferences',
    {
      schema: {
        params: filePreferenceScopeSchema,
        response: { ...errorResponses, 200: filePreferencesResponseSchema },
      },
    },
    async (request) => ({
      preferences: await options.application.listFilePreferences(
        request.params.worktreeId,
      ),
    }),
  );
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
