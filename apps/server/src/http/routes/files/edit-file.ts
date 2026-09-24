import type { Limits } from '../../../config/limits.ts';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  editFileRequestSchema,
  editFileResponseSchema,
} from '@porcelain/contracts/files';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { EditFileUseCase } from '../../../use-cases/files/edit-file.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function editFile(
  server: FastifyInstance,
  options: {
    useCase: Pick<EditFileUseCase, 'execute'>;
    limits: Limits['http'];
  },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/files',
    {
      schema: {
        params: worktreeParamsSchema,
        body: editFileRequestSchema,
        response: { ...errorResponses, 200: editFileResponseSchema },
      },
      bodyLimit: options.limits.editFileBodyBytes,
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
