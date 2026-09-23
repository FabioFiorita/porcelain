import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { projectDiscoveryResponseSchema } from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { DiscoverProjectsController } from '../../../controllers/discover-projects-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function discoverProjects(
  server: FastifyInstance,
  options: { controller: Pick<DiscoverProjectsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/projects/discover',
    {
      schema: {
        response: { ...errorResponses, 200: projectDiscoveryResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute({ signal: request.disconnected }),
  );
}
