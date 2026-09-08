import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../interfaces/application.ts';
import { toInventoryResponse } from '../mappers/inventory-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function refreshInventoryRoute(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/inventory/refresh',
    {
      schema: { response: { ...errorResponses, 200: inventoryResponseSchema } },
    },
    async () => {
      const { inventory } = await options.application.refresh();
      return toInventoryResponse(inventory);
    },
  );
}
