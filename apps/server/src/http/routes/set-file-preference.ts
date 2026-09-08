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
        tags: ['File preferences'],
        summary: 'Pin, hide, or clear a path preference',
        params: filePreferenceScopeSchema,
        body: setFilePreferenceRequestSchema.meta({
          examples: [{ path: 'README.md', flag: 'pinned', value: true }],
        }),
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
