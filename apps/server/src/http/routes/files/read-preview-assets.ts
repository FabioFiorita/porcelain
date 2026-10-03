import { readPreviewAssetsEndpoint } from '@porcelain/contracts/files';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadPreviewAssetsUseCase } from '../../../use-cases/files/read-preview-assets.ts';

export function readPreviewAssets(
  server: FastifyInstance,
  options: { useCase: Pick<ReadPreviewAssetsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readPreviewAssetsEndpoint.method,
    url: readPreviewAssetsEndpoint.path,
    schema: readPreviewAssetsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
