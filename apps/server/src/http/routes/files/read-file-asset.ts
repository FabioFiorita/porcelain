import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readFileAssetQuerySchema,
  readFileAssetResponseSchema,
} from '@porcelain/contracts/files';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadFileAssetUseCase } from '../../../use-cases/files/read-file-asset.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readFileAsset(
  server: FastifyInstance,
  options: { useCase: Pick<ReadFileAssetUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/asset',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: readFileAssetQuerySchema,
        response: { ...errorResponses, 200: readFileAssetResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
