import { httpErrors } from '@fastify/sensible';
import type { FastifyRequest } from 'fastify';
import type {
  CheckRequestOriginUseCase,
  RequestOriginVerdict,
} from '../../use-cases/access/check-request-origin.ts';

type Refusal = Extract<RequestOriginVerdict, { allowed: false }>['refusal'];

export type RequestOriginOptions = {
  access: { checkRequestOrigin: Pick<CheckRequestOriginUseCase, 'execute'> };
  allowedHosts: readonly string[];
};

function refusalMessage(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'host-malformed':
      return 'The Host header is missing or malformed';
    case 'host-not-allowed':
      return `This server does not answer to the host ${refusal.hostname}`;
    case 'origin-required':
      return 'The Origin header is required';
    case 'origin-opaque':
      return 'An opaque origin cannot write';
    case 'origin-malformed':
      return 'The Origin header is malformed';
    case 'cross-origin':
      return `The origin ${refusal.origin} cannot write here`;
  }
}

export function checkRequestOrigin(
  options: RequestOriginOptions,
  requireSameOrigin = false,
) {
  return async (request: FastifyRequest) => {
    const result = options.access.checkRequestOrigin.execute({
      host: request.headers.host,
      origin: request.headers.origin,
      method: request.method,
      scheme: request.protocol,
      localAddress: request.socket.localAddress,
      allowedHosts: options.allowedHosts,
      requireSameOrigin,
    });
    if (!result.allowed)
      throw httpErrors.forbidden(refusalMessage(result.refusal));
  };
}
