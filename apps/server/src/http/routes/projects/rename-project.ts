import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  renameProjectParamsSchema,
  renameProjectRequestSchema,
  renameProjectResponseSchema,
} from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { RenameProjectUseCase } from '../../../use-cases/projects/rename-project.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function renameProject(
  server: FastifyInstance,
  options: { useCase: Pick<RenameProjectUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.patch(
    '/projects/:projectId',
    {
      schema: {
        params: renameProjectParamsSchema,
        body: renameProjectRequestSchema,
        response: { ...errorResponses, 200: renameProjectResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
