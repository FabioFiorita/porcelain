import { LIMITS } from './limits.ts';

export function readDesktopLimits() {
  return {
    desktop: LIMITS.desktop,
    credentials: LIMITS.access.credentials,
    installer: LIMITS.installer.command,
    owner: LIMITS.owner.requestTimeoutMs,
  };
}
