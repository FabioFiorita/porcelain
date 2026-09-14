import type { apiErrorSchema } from '@porcelain/contracts/api-error';
import { ConnectionError } from './connection-error.ts';

type ApiError = ReturnType<typeof apiErrorSchema.parse>;

export class RequestError extends ConnectionError {
  readonly status: number;
  readonly code: ApiError['code'];
  constructor(status: number, code: ApiError['code'], message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'RequestError';
  }
}
