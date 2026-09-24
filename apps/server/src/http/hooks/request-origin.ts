import { httpErrors } from '@fastify/sensible';
import type { FastifyRequest } from 'fastify';
import type { CheckRequestOriginUseCase } from '../../use-cases/access/check-request-origin.ts';

export type RequestOriginOptions = {
  access: { checkRequestOrigin: Pick<CheckRequestOriginUseCase, 'execute'> };
  allowedHosts: readonly string[];
};

const originRefusals = new Map<string, (request: FastifyRequest) => string>([
  ['host-missing', () => 'The Host header is missing or malformed'],
  [
    'host-not-allowed',
    (request) => `This server does not answer to the host ${request.hostname}`,
  ],
  ['origin-required', () => 'The Origin header is required'],
  ['origin-opaque', () => 'An opaque origin cannot write'],
  ['origin-malformed', () => 'The Origin header is malformed'],
  [
    'origin-not-allowed',
    (request) => `The origin ${request.headers.origin ?? ''} cannot write here`,
  ],
]);

function refusalMessage(reason: string, request: FastifyRequest): string {
  return originRefusals.get(reason)?.(request) ?? reason;
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
      throw httpErrors.forbidden(refusalMessage(result.reason, request));
  };
}
