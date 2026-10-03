import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FailureReport, Logger } from '../ports/logger.ts';
import { abandonedByClient, toStatusResponse } from './status-policy.ts';

type FailedRequest = Pick<
  FastifyRequest,
  'id' | 'method' | 'url' | 'disconnected'
>;

export function requestFailure(
  error: unknown,
  statusCode: number,
  request: FailedRequest,
): FailureReport | undefined {
  if (
    statusCode < 500 ||
    abandonedByClient(error, request.disconnected.aborted)
  )
    return undefined;
  return {
    kind: 'request',
    requestId: request.id,
    method: request.method,
    url: request.url.split('?', 1)[0] ?? '',
    error,
  };
}

export function errorHandler(logger: Logger) {
  return (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const { statusCode, body } = toStatusResponse(error);
    const failure = requestFailure(error, statusCode, request);
    if (failure !== undefined) logger.failure(failure);
    if (statusCode === 401) reply.header('WWW-Authenticate', 'Bearer');
    return reply.code(statusCode).send(body);
  };
}
