import { useDaemonIdentity, useEnvironmentName } from '@renderer/hooks/use-daemon-identity'
import { useLocalDaemon } from '@renderer/hooks/use-local-terminal'
import { clientVersion } from '@renderer/lib/client-version'
import { isLoopbackHostname, shouldPromptDaemonUpdate } from '@renderer/lib/daemon-update'
import { isBrowser } from '@renderer/lib/platform'
import { usePreferencesStore } from '@renderer/stores/preferences'

export interface DaemonUpdatePrompt {
  /** The daemon's version — only set while the prompt should be visible. */
  daemonVersion: string
  daemonHost: string
  /**
   * What to CALL that daemon: its Environment nickname when it has one, otherwise the machine
   * name. The host stays the dismissal key — a nickname can change, and a waved-off version
   * must stay waved off when it does.
   */
  daemonName: string
  clientVersion: string
  dismiss: () => void
}

/**
 * Is this window bound to a daemon on ANOTHER machine?
 *
 * Electron answers exactly: the shell owns the local daemon and `localDaemon.isLocal` says
 * whether this window is on it. Undefined means the query has not landed yet — treat that as
 * local so the prompt never flashes during startup.
 *
 * The browser client has no shell to ask, so it uses the page origin: a tab served from
 * loopback is the daemon on this machine; anything else (a tailnet name, a LAN address, a
 * Cloudflare hostname) is remote.
 */
function useIsRemoteDaemon(): boolean {
  const local = useLocalDaemon()
  if (!isBrowser) return local?.isLocal === false
  if (typeof window === 'undefined') return false
  return !isLoopbackHostname(window.location.hostname)
}

/**
 * The remote-daemon update prompt, or null when there is nothing to say.
 *
 * Deliberately separate from `useUpdateStatus` (the Electron auto-updater): that one updates
 * the app in front of you and can install it itself; this one is about a host you can only
 * reach with a command, so the affordance is copy-a-command, not install.
 */
export function useDaemonUpdatePrompt(): DaemonUpdatePrompt | null {
  const identity = useDaemonIdentity()
  const environmentName = useEnvironmentName()
  const isRemote = useIsRemoteDaemon()
  const dismissed = usePreferencesStore((s) => s.dismissedDaemonUpdates)
  const dismissDaemonUpdate = usePreferencesStore((s) => s.dismissDaemonUpdate)
  const version = clientVersion()

  const show = shouldPromptDaemonUpdate({
    clientVersion: version,
    daemonVersion: identity.version,
    daemonHost: identity.host,
    isRemote,
    dismissed,
  })
  if (!show || identity.version === null || identity.host === null) return null

  const daemonVersion = identity.version
  const daemonHost = identity.host
  return {
    daemonVersion,
    daemonHost,
    daemonName: environmentName ?? daemonHost,
    clientVersion: version,
    dismiss: () => dismissDaemonUpdate(daemonHost, daemonVersion),
  }
}
