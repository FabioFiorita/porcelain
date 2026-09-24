import { httpErrors } from '@fastify/sensible';
import type { FastifyRequest } from 'fastify';
import type { CheckRequestOriginUseCase } from '../../use-cases/access/check-request-origin.ts';

export type RequestOriginOptions = {
  access: { checkRequestOrigin: Pick<CheckRequestOriginUseCase, 'execute'> };
  allowedHosts: readonly string[];
};

export function checkRequestOrigin(
  options: RequestOriginOptions,
  requireSameOrigin = false,
) {
  return async (request: FastifyRequest) => {
    const result = await options.access.checkRequestOrigin.execute(
      {
        host: request.headers.host,
        origin: request.headers.origin,
        method: request.method,
        scheme: request.protocol,
        localAddress: request.socket.localAddress,
        allowedHosts: options.allowedHosts,
        requireSameOrigin,
      },
      {},
    );
    if (!result.allowed) throw httpErrors.forbidden(result.reason);
  };
}
