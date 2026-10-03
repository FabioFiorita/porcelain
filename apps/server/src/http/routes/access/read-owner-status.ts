import { readOwnerStatusEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadOwnerStatusUseCase } from '../../../use-cases/access/read-owner-status.ts';

export function readOwnerStatus(
  server: FastifyInstance,
  options: { useCase: Pick<ReadOwnerStatusUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readOwnerStatusEndpoint.method,
    url: readOwnerStatusEndpoint.path,
    schema: readOwnerStatusEndpoint.schema,
    handler: () => options.useCase.execute({}),
  });
}
