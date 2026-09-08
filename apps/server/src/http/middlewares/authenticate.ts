import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export function authenticate(token: string) {
  const expected = Buffer.from(`Bearer ${token}`);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const received = Buffer.from(request.headers.authorization ?? '');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      return reply.header('WWW-Authenticate', 'Bearer').code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }
  };
}
