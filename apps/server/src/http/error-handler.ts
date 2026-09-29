import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from '../ports/logger.ts';
import { failureWorthLogging, toStatusResponse } from './status-policy.ts';

export function errorHandler(logger: Logger) {
  return (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const { statusCode, body } = toStatusResponse(error);
    if (failureWorthLogging(error, request.disconnected.aborted))
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
