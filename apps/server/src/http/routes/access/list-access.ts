import { listAccessEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListAccessUseCase } from '../../../use-cases/access/list-access.ts';

export function listAccess(
  server: FastifyInstance,
  options: { useCase: Pick<ListAccessUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listAccessEndpoint.method,
    url: listAccessEndpoint.path,
    schema: listAccessEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(
        { viewer: request.caller },
        { signal: request.disconnected },
      ),
  });
}
