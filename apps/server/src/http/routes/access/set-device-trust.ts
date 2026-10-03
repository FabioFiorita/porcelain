import { setDeviceTrustEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { SetDeviceTrustUseCase } from '../../../use-cases/access/set-device-trust.ts';

export function setDeviceTrust(
  server: FastifyInstance,
  options: { useCase: Pick<SetDeviceTrustUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: setDeviceTrustEndpoint.method,
    url: setDeviceTrustEndpoint.path,
    schema: setDeviceTrustEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  });
}
