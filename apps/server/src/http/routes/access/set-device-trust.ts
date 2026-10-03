import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  setDeviceTrustRequestSchema,
  setDeviceTrustResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { SetDeviceTrustUseCase } from '../../../use-cases/access/set-device-trust.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setDeviceTrust(
  server: FastifyInstance,
  options: { useCase: Pick<SetDeviceTrustUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/access/trust',
    {
      schema: {
        body: setDeviceTrustRequestSchema,
        response: { ...errorResponses, 200: setDeviceTrustResponseSchema },
      },
    },
    (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
