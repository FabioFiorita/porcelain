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

class HttpFailureMessage extends Schema.TaggedError<HttpFailureMessage>()(
  'HttpFailureMessage',
  { name: Schema.String, message: Schema.String },
) {}

export function httpFailure<E extends Error>(
  error: new (...args: never[]) => E,
  status: keyof typeof reasons,
  wire: { message?: string | { fromError: true }; code?: ApiErrorCode } = {},
) {
  const message =
    typeof wire.message === 'object'
      ? undefined
      : (wire.message ?? new error().message);
  const body = {
    statusCode: HttpStatus.fromLiteral(status),
    error: reasons[status],
    ...(wire.code === undefined ? {} : { code: wire.code }),
  };
  const wireBody = Schema.Struct({
    statusCode: Schema.Literal(body.statusCode),
    error: Schema.Literal(body.error),
    message: message === undefined ? Schema.String : Schema.Literal(message),
    code: Schema.optionalKey(
      wire.code === undefined ? Schema.Never : Schema.Literal(wire.code),
    ),
  });
  return wireBody.pipe(
    Schema.decodeTo(
      Schema.declare(
        (value: unknown): value is E | HttpFailureMessage =>
          value instanceof error ||
          (value instanceof HttpFailureMessage && value.name === error.name),
      ),
      SchemaTransformation.transform<
        E | HttpFailureMessage,
        typeof wireBody.Type
      >({
        decode: (value) =>
          message === undefined
            ? new HttpFailureMessage({
                name: error.name,
                message: value.message,
              })
            : new error(),
        encode: (failure) => ({ ...body, message: message ?? failure.message }),
      }),
    ),
    HttpApiSchema.status(status),
  );
}
