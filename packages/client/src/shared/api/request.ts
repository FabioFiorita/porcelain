import {
  apiErrorSchema,
  endpointPath,
  type ApiErrorCode,
  type Endpoint,
  type EndpointRequest,
  type EndpointResponse,
} from '@porcelain/contracts/shared';
import { ConnectionError } from './connection-error.ts';
import type { Transport } from './transport.ts';

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

export function isEndpointError<Api extends Endpoint>(
  error: unknown,
  endpoint: Api,
  code: keyof Api['errors'],
) {
  return (
    error instanceof RequestError &&
    error.code === code &&
    error.status === endpoint.errors[error.code]
  );
}

export function requestEndpoint<Api extends Endpoint>(
  transport: Transport,
  endpoint: Api,
  input: EndpointRequest<Api>,
): Promise<EndpointResponse<Api>>;
export async function requestEndpoint(
  transport: Transport,
  endpoint: Endpoint,
  input: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<unknown> {
  const path = endpointPath(endpoint, input);
  const body = endpoint.schema.body?.encode(input.body);
  let response: Response;
  try {
    response = await transport(path, {
      method: endpoint.method,
      ...(endpoint.schema.body === undefined
        ? {}
        : {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      redirect: 'error',
      cache: 'no-store',
    });
  } catch (error) {
    if (input.signal?.aborted) throw error;
    throw new ConnectionError('Could not reach Porcelain. Try again.', {
      cause: error,
    });
  }
  const schema = endpoint.responses[response.status];
  if (schema === undefined) {
    const body: unknown = await response.json().catch(() => undefined);
    const parsed = apiErrorSchema.safeParse(body);
    const code = parsed.success ? parsed.data.code : undefined;
    throw new RequestError(
      response.status,
      parsed.success
        ? parsed.data.message
        : `Request failed (${response.status})`,
      code !== undefined && endpoint.errors[code] === response.status
        ? code
        : undefined,
    );
  }
  const value: unknown =
    response.status === 204
      ? undefined
      : endpoint.format === 'text'
        ? await response.text()
        : await response.json();
  return schema.parse(value);
}
