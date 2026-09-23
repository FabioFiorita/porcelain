import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readFileAssetQuerySchema,
  readFileAssetResponseSchema,
} from '@porcelain/contracts/files';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadFileAssetController } from '../../../controllers/read-file-asset-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readFileAsset(
  server: FastifyInstance,
  options: { controller: Pick<ReadFileAssetController, 'execute'> },
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
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
