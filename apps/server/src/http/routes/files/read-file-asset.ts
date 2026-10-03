import { readFileAssetEndpoint } from '@porcelain/contracts/files';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadFileAssetUseCase } from '../../../use-cases/files/read-file-asset.ts';

export function readFileAsset(
  server: FastifyInstance,
  options: { useCase: Pick<ReadFileAssetUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readFileAssetEndpoint.method,
    url: readFileAssetEndpoint.path,
    schema: readFileAssetEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
