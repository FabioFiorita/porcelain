import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  startServiceUpdateRequestSchema,
  startServiceUpdateResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { StartServiceUpdateUseCase } from '../../../use-cases/access/start-service-update.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function startServiceUpdate(
  server: FastifyInstance,
  options: { useCase: Pick<StartServiceUpdateUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/service/update',
    {
      schema: {
        body: startServiceUpdateRequestSchema,
        response: { ...errorResponses, 202: startServiceUpdateResponseSchema },
      },
    },
    async (request, reply) => {
      const state = await options.useCase.execute(
        {
          version: request.body.version,
          viewer: request.caller,
          local: request.local,
        },
        { signal: request.disconnected },
      );
      return reply.code(202).send(state);
    },
  );
}
