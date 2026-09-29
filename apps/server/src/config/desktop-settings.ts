import { LIMITS } from './limits.ts';

export function readDesktopLimits() {
  return {
    desktop: LIMITS.desktop,
    installer: LIMITS.installer.command,
    owner: LIMITS.owner.requestTimeoutMs,
  };
}
