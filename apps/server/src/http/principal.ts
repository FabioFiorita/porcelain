import type { FastifyRequest } from 'fastify';
import type { AuthenticatedPrincipal } from '../models/principal.ts';
import { UnauthorizedError } from './errors/unauthorized-error.ts';

export function callerOf(request: FastifyRequest): AuthenticatedPrincipal {
  const principal = request.principal;
  if (principal.kind === 'anonymous') throw new UnauthorizedError();
  return principal;
}
