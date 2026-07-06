import { daemonToken } from '@renderer/lib/daemon'

/**
 * Exposes the daemon session token to components (Settings' "Copy token") —
 * components are lint-fenced from importing lib/daemon directly, so this hook
 * is the sanctioned crossing. The token is stable per app run; no subscription.
 */
export function useDaemonToken(): string {
  return daemonToken()
}
