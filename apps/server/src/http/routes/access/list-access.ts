import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listAccessResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ListAccessUseCase } from '../../../use-cases/access/list-access.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listAccess(
  server: FastifyInstance,
  options: { useCase: Pick<ListAccessUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/access',
    {
      schema: {
        response: { ...errorResponses, 200: listAccessResponseSchema },
      },
    },
    () => options.useCase.execute({}),
  );
}
