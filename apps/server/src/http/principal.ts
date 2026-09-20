import type { FastifyRequest } from 'fastify';
import type { AuthenticatedPrincipal } from '../models/principal.ts';
import { UnauthorizedError } from './errors/unauthorized-error.ts';

/**
 * The principal to pass into the application.  Routes that reach a use case sit
 * behind an authentication hook, so an anonymous caller here means the hook was
 * not registered; failing closed is the only safe reading of that.
 */
export function callerOf(request: FastifyRequest): AuthenticatedPrincipal {
  const principal = request.principal;
  if (principal.kind === 'anonymous') throw new UnauthorizedError();
  return principal;
}
