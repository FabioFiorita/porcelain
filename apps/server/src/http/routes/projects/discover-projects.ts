import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { discoverProjectsResponseSchema } from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { DiscoverProjectsUseCase } from '../../../use-cases/projects/discover-projects.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function discoverProjects(
  server: FastifyInstance,
  options: { useCase: Pick<DiscoverProjectsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/projects/discover',
    {
      schema: {
        response: { ...errorResponses, 200: discoverProjectsResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  );
}
