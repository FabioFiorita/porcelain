import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  listFilePreferencesParamsSchema,
  listFilePreferencesResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { ListFilePreferencesController } from '../../../controllers/list-file-preferences-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listFilePreferences(
  server: FastifyInstance,
  options: { controller: Pick<ListFilePreferencesController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/projects/:projectId/file-preferences',
    {
      schema: {
        params: listFilePreferencesParamsSchema,
        response: { ...errorResponses, 200: listFilePreferencesResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
