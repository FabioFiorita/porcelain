import { editFileEndpoint } from '@porcelain/contracts/files';
import type { Limits } from '../../../config/limits.ts';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { EditFileUseCase } from '../../../use-cases/files/edit-file.ts';

export function editFile(
  server: FastifyInstance,
  options: {
    useCase: Pick<EditFileUseCase, 'execute'>;
    limits: Limits['http'];
  },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: editFileEndpoint.method,
    url: editFileEndpoint.path,
    schema: editFileEndpoint.schema,
    bodyLimit: options.limits.editFileBodyBytes,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
