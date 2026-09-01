/**
 * Web Remote feature public entry point.
 *
 * Settings and shell chrome import this module only — never a Remote implementation file.
 */

// browser session
export { useTokenGate } from './remote-session'

// share / listeners
export {
  type AccessStatus,
  type CloudflareStatus,
  type LanStatus,
  type TailnetStatus,
  useAccessStatus,
  useCloudflareStatus,
  useIssuePairingLink,
  useLanStatus,
  useRevokeAuthorizedClient,
  useRevokePairingLink,
  useSetCloudflareBind,
  useSetLanBind,
  useSetTailnetBind,
  useTailnetStatus,
} from './remote-settings'
// shell / environments
export {
  type EnvironmentEndpoint,
  type EnvironmentStatus,
  useConnectRemoteEnvironment,
  useDisconnectRemoteEnvironment,
  useEnvironmentStatuses,
  useOpenWindowInEnvironment,
  usePairEnvironmentConnection,
  useRemoteEnvironments,
  useRemoveEnvironmentEndpoint,
  useRemoveRemoteEnvironment,
  useRenameEnvironment,
  useShellEnvironmentConnections,
} from './remote-shell'
