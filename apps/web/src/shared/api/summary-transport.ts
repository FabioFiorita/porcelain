import type { Transport } from '@porcelain/client/transport';

export const summaryTransport: Transport = (url, init) =>
  fetch(url, {
    ...init,
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
  });
