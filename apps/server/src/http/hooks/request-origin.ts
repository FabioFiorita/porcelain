import { httpErrors } from '@fastify/sensible';
import type { FastifyRequest } from 'fastify';
import type { CheckRequestOriginController } from '../../controllers/check-request-origin-controller.ts';

export type RequestOriginOptions = {
  checkRequestOriginController: Pick<CheckRequestOriginController, 'execute'>;
  allowedHosts: readonly string[];
};

export function checkRequestOrigin(
  options: RequestOriginOptions,
  requireSameOrigin = false,
) {
  return async (request: FastifyRequest) => {
    const result = options.checkRequestOriginController.execute(
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
