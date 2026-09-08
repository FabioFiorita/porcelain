import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toInventoryResponse } from '../mappers/inventory-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function getInventoryRoute(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().get(
    '/inventory',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'List registered projects and discovered worktrees',
        response: { ...errorResponses, 200: inventoryResponseSchema },
      },
    },
    async () => toInventoryResponse(options.application.inventory()),
  );
}
