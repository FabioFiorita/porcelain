import type { FastifyReply, FastifyRequest } from 'fastify';
import { toStatusResponse } from './status-policy.ts';

export function handleError(
  error: unknown,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const { statusCode, body } = toStatusResponse(error);
  if (statusCode === 401) reply.header('WWW-Authenticate', 'Bearer');
  return reply.code(statusCode).send(body);
}
