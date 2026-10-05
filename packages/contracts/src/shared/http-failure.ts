import { Schema, SchemaTransformation } from 'effect';
import { HttpStatus } from 'effect/http';
import { HttpApiSchema } from 'effect/http-api';
import type { ApiErrorCode } from './api-error.ts';

const reasons = {
  BadRequest: 'Bad Request',
  Unauthorized: 'Unauthorized',
  Forbidden: 'Forbidden',
  PayloadTooLarge: 'Payload Too Large',
  TooManyRequests: 'Too Many Requests',
  BadGateway: 'Bad Gateway',
  ServiceUnavailable: 'Service Unavailable',
  NotFound: 'Not Found',
  Conflict: 'Conflict',
  UnprocessableEntity: 'Unprocessable Entity',
} as const;

type ErrorClass<E> = new () => E;

export function httpFailure<E extends Error>(
  error: ErrorClass<E>,
  status: keyof typeof reasons,
  wire: { message?: string; code?: ApiErrorCode } = {},
) {
  const body = {
    statusCode: HttpStatus.fromLiteral(status),
    error: reasons[status],
    message: wire.message ?? new error().message,
    ...(wire.code === undefined ? {} : { code: wire.code }),
  };
  const wireBody = Schema.Struct({
    statusCode: Schema.Literal(body.statusCode),
    error: Schema.Literal(body.error),
    message: Schema.Literal(body.message),
    code: Schema.optionalKey(
      wire.code === undefined ? Schema.Never : Schema.Literal(wire.code),
    ),
  });
  return wireBody.pipe(
    Schema.decodeTo(
      Schema.declare((value: unknown): value is E => value instanceof error),
      SchemaTransformation.transform<E, typeof wireBody.Type>({
        decode: () => new error(),
        encode: () => body,
      }),
    ),
    HttpApiSchema.status(status),
  );
}
