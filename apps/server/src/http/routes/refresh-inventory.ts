import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toInventoryResponse } from '../mappers/inventory-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function refreshInventoryRoute(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/inventory/refresh',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'Refresh worktrees from Git',
        response: { ...errorResponses, 200: inventoryResponseSchema },
      },
    },
    async () => {
      const { inventory } = await options.application.refresh();
      return toInventoryResponse(inventory);
    },
  );
}
