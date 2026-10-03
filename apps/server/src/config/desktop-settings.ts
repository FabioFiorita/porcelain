import { LIMITS } from './limits.ts';

export function readDesktopLimits() {
  return {
    desktop: LIMITS.desktop,
    credentials: LIMITS.access.credentials,
    owner: LIMITS.owner.requestTimeoutMs,
  };
}
