import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';
import { browserSessionValid, setBrowserSession } from './browser-session.ts';

export function authenticate(token: string) {
  const expected = Buffer.from(`Bearer ${token}`);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.headers.authorization && browserSessionValid(request, token))
      return;
    const received = Buffer.from(request.headers.authorization ?? '');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedError();
    }
    if (
      request.method === 'GET' &&
      request.url === '/inventory' &&
      request.headers['x-porcelain-browser'] === '1'
    ) {
      setBrowserSession(reply, token, request.protocol === 'https');
    }
  };
}
