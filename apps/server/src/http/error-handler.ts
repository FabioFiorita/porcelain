import { HttpServerResponse, type HttpServerRequest } from 'effect/http';
import type { FailureReport, Logger } from '../ports/logger.ts';
import { abandonedByClient, toStatusResponse } from './status-policy.ts';

type FailedRequest = {
  id: string;
  method: string;
  url: string;
  abandoned: boolean;
};

export function requestFailure(
  error: unknown,
  statusCode: number,
  request: FailedRequest,
): FailureReport | undefined {
  if (statusCode < 500 || abandonedByClient(error, request.abandoned))
    return undefined;
  return {
    kind: 'request',
    requestId: request.id,
    method: request.method,
    url: request.url.split('?', 1)[0] ?? '',
    error,
  };
}

export function errorResponse(
  error: unknown,
  request: HttpServerRequest.HttpServerRequest,
  logger: Logger,
) {
  const { statusCode, body } = toStatusResponse(error);
  const failure = requestFailure(error, statusCode, {
    id: crypto.randomUUID(),
    method: request.method,
    url: request.originalUrl,
    abandoned:
      request.source instanceof Object &&
      'aborted' in request.source &&
      request.source.aborted === true,
  });
  if (failure !== undefined) logger.failure(failure);
  const headers = statusCode === 401 ? { 'WWW-Authenticate': 'Bearer' } : {};
  return body === undefined
    ? HttpServerResponse.empty({ status: statusCode, headers })
    : HttpServerResponse.jsonUnsafe(body, { status: statusCode, headers });
}
