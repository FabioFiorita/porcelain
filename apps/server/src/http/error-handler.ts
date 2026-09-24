import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from '../ports/logger.ts';
import { toStatusResponse } from './status-policy.ts';

export function errorHandler(logger: Logger) {
  return (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const { statusCode, body } = toStatusResponse(error);
    if (statusCode >= 500)
      logger.failure({
        kind: 'request',
        requestId: request.id,
        method: request.method,
        url: request.url,
        error,
      });
    if (statusCode === 401) reply.header('WWW-Authenticate', 'Bearer');
    return reply.code(statusCode).send(body);
  };
}
