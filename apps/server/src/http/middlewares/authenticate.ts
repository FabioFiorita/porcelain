import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedPrincipal } from '../../models/principal.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';
import { browserSessionValid, setBrowserSession } from './browser-session.ts';

const viewer: AuthenticatedPrincipal = { kind: 'viewer', deviceId: null };

/**
 * Check the caller's credential and record who they are.  The grant is the
 * door's, not the caller's: nothing a request carries can name a principal.
 */
export function authenticate(
  token: string,
  grant: AuthenticatedPrincipal = viewer,
) {
  const expected = Buffer.from(`Bearer ${token}`);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.headers.authorization && browserSessionValid(request, token)) {
      request.principal = grant;
      return;
    }
    const received = Buffer.from(request.headers.authorization ?? '');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedError();
    }
    request.principal = grant;
    const path = request.url.split('?', 1)[0];
    if (
      request.method === 'GET' &&
      path === '/api/inventory' &&
      request.headers['x-porcelain-browser'] === '1'
    ) {
      setBrowserSession(reply, token, request.protocol === 'https');
    }
  };
}
