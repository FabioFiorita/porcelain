import { readInventoryEndpoint } from '@porcelain/contracts/projects';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadInventoryUseCase } from '../../../use-cases/projects/read-inventory.ts';

export function readInventory(
  server: FastifyInstance,
  options: { useCase: Pick<ReadInventoryUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readInventoryEndpoint.method,
    url: readInventoryEndpoint.path,
    schema: readInventoryEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  });
}
