import { Schema } from 'effect';
import { ERROR_STATUS_MAX, ERROR_STATUS_MIN } from './limits.ts';

const apiErrorCodeSchema = Schema.Literals([
  'content_changed',
  'file_too_large',
  'unsupported_text',
  'worktree_changed',
]);

export const apiErrorSchema = Schema.Struct({
  statusCode: Schema.Number.check(Schema.isInt())
    .check(Schema.isGreaterThanOrEqualTo(ERROR_STATUS_MIN))
    .check(Schema.isLessThanOrEqualTo(ERROR_STATUS_MAX)),
  error: Schema.String,
  message: Schema.String,
  code: Schema.optional(apiErrorCodeSchema),
});

export type ApiErrorCode = typeof apiErrorCodeSchema.Type;
export type ApiError = typeof apiErrorSchema.Type;

export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  content_changed: 409,
  file_too_large: 422,
  unsupported_text: 422,
  worktree_changed: 409,
};
