import { httpErrors } from '@fastify/sensible';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedPrincipal } from '@porcelain/contracts/access';

export function callerOf(request: FastifyRequest): AuthenticatedPrincipal {
  const principal = request.principal;
  if (principal.kind === 'anonymous')
    throw httpErrors.unauthorized('Authentication required');
  return principal;
}
