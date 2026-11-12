import { REQUEST_TIMEOUT_MS } from '../../config/limits';
import { demoMetadata } from '../adapters/demo-transport';

export function sendRequest(address: URL, init?: RequestInit) {
  const demo = demoMetadata(address);
  if (demo) return Promise.resolve(demo);
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(address, {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
}
