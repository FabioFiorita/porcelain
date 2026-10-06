import { apiErrorSchema } from '@porcelain/contracts/shared';
import { Schema } from 'effect';

export class RequestError extends Schema.TaggedError<RequestError>()(
  'RequestError',
  {
    status: Schema.Number,
    message: Schema.String,
    code: apiErrorSchema.fields.code,
  },
) {}
