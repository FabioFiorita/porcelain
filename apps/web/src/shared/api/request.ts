import { apiErrorSchema, type ApiErrorCode } from '@porcelain/contracts/shared';
import { ConnectionError } from './connection-error';

type ResponseSchema<T> = { parse(value: unknown): T };

export class RequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | undefined;

  constructor(status: number, message: string, code?: ApiErrorCode) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
  }
}

export async function requestJson<T>(
  transport: typeof fetch,
  path: string,
  schema: ResponseSchema<T>,
  init: RequestInit,
  acceptedStatuses: readonly number[] = [],
): Promise<T> {
  let response: Response;
  try {
    response = await transport(path, {
      ...init,
      redirect: 'error',
      cache: 'no-store',
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ConnectionError('Could not reach Porcelain. Try again.', {
      cause: error,
    });
  }
  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    const body: unknown = await response.json().catch(() => undefined);
    const parsed = apiErrorSchema.safeParse(body);
    throw new RequestError(
      response.status,
      parsed.success
        ? parsed.data.message
        : `Request failed (${response.status})`,
      parsed.success ? parsed.data.code : undefined,
    );
  }
  return schema.parse(await response.json());
}
