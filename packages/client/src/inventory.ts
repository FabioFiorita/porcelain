import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import { ConnectionError } from './errors/connection-error.ts';

export async function readInventory(options: {
  endpoint: string;
  token: string;
  fetch: typeof fetch;
  signal: AbortSignal;
  refresh?: boolean;
}) {
  const transport = options.fetch;
  try {
    const response = await transport(
      options.endpoint +
        (options.refresh ? '/inventory/refresh' : '/inventory'),
      {
        method: options.refresh ? 'POST' : 'GET',
        headers: { authorization: `Bearer ${options.token}` },
        signal: options.signal,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      },
    );
    if (response.status === 401)
      throw new ConnectionError(
        'Access token was rejected. Check it and try again.',
      );
    if (!response.ok)
      throw new ConnectionError(
        'The environment could not complete the request. Try again.',
      );
    const parsed = inventoryResponseSchema.safeParse(await response.json());
    if (!parsed.success)
      throw new ConnectionError(
        'The server returned an incompatible inventory.',
      );
    return parsed.data;
  } catch (error) {
    if (options.signal.aborted) throw error;
    if (error instanceof ConnectionError) throw error;
    throw new ConnectionError(
      'Could not reach the environment. Check that the server is running.',
      { cause: error },
    );
  }
}
