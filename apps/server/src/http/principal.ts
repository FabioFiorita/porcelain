import { httpErrors } from '@fastify/sensible';
import type { Principal } from '@porcelain/contracts/access';
import type { FastifyRequest } from 'fastify';

export function callerOf(request: FastifyRequest): Principal {
  const principal = request.principal;
  if (principal === undefined)
    throw httpErrors.unauthorized('Authentication required');
  return principal;
}
