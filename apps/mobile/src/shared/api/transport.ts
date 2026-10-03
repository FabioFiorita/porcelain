import { REQUEST_TIMEOUT_MS } from '../../config/limits';

export function sendRequest(address: URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(address, {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
}
