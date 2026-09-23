import type { FastifyRequest } from 'fastify';
import type { AuthenticatedPrincipal } from '@porcelain/contracts/access';

export function callerOf(request: FastifyRequest): AuthenticatedPrincipal {
  const principal = request.principal;
  if (principal.kind === 'anonymous')
    throw new Error('Authenticated route has no principal');
  return principal;
}
