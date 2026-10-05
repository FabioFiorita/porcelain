import { redeemPairingUrl } from '@porcelain/client/access/api';
import type { Transport } from '@porcelain/client/transport';
import { reportUnauthorized } from './unauthorized';

export function browserTransport(
  transport: typeof fetch,
  options: { reportUnauthorized?: boolean } = {},
): Transport {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete('authorization');
    headers.set('x-porcelain-browser', '1');
    const response = await transport(input, {
      ...init,
      headers,
      credentials: 'same-origin',
    });
    if (
      response.status === 401 &&
      input !== redeemPairingUrl() &&
      options.reportUnauthorized !== false
    )
      reportUnauthorized();
    return response;
  };
}
