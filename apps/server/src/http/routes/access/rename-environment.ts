import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  renameEnvironmentRequestSchema,
  renameEnvironmentResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { RenameEnvironmentUseCase } from '../../../use-cases/access/rename-environment.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function renameEnvironment(
  server: FastifyInstance,
  options: { useCase: Pick<RenameEnvironmentUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/environment/name',
    {
      schema: {
        body: renameEnvironmentRequestSchema,
        response: { ...errorResponses, 200: renameEnvironmentResponseSchema },
      },
    },
    (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
