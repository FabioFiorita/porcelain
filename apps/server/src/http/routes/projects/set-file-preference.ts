import { setFilePreferenceEndpoint } from '@porcelain/contracts/projects';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { SetFilePreferenceUseCase } from '../../../use-cases/projects/set-file-preference.ts';

export function setFilePreference(
  server: FastifyInstance,
  options: { useCase: Pick<SetFilePreferenceUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: setFilePreferenceEndpoint.method,
    url: setFilePreferenceEndpoint.path,
    schema: setFilePreferenceEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
