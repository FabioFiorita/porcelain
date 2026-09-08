import { isAbsolute } from 'node:path';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  projectResponseSchema,
  registerProjectRequestSchema,
} from '@porcelain/contracts/inventory';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toProjectResponse } from '../mappers/inventory-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function registerProjectRoute(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/projects',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'Register an existing repository',
        body: registerProjectRequestSchema.refine((input) =>
          isAbsolute(input.path),
        ),
        response: { ...errorResponses, 200: projectResponseSchema },
      },
    },
    async (request) => {
      const { project } = await options.application.register(request.body.path);
      return toProjectResponse(project);
    },
  );
}
