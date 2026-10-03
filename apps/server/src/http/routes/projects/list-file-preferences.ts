import { listFilePreferencesEndpoint } from '@porcelain/contracts/projects';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListFilePreferencesUseCase } from '../../../use-cases/projects/list-file-preferences.ts';

export function listFilePreferences(
  server: FastifyInstance,
  options: { useCase: Pick<ListFilePreferencesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listFilePreferencesEndpoint.method,
    url: listFilePreferencesEndpoint.path,
    schema: listFilePreferencesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
