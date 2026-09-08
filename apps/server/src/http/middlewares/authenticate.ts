import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';

export function authenticate(token: string) {
  const expected = Buffer.from(`Bearer ${token}`);
  return async (request: FastifyRequest) => {
    const received = Buffer.from(request.headers.authorization ?? '');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedError();
    }
  };
}
