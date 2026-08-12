/**
 * Web Remote feature public entry point (REM-004).
 *
 * Settings and shell chrome import this module only — never a Remote implementation file.
 */

// browser session
export { useTokenGate } from './remote-session'

// share / listeners
export {
  type AccessStatus,
  type FunnelStatus,
  type LanStatus,
  type TailnetStatus,
  useAccessStatus,
  useFunnelStatus,
  useIssuePairingLink,
  useLanStatus,
  useRevokeAuthorizedClient,
  useRevokePairingLink,
  useSetFunnelBind,
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
  usePreferEnvironmentEndpoint,
  useRemoteEnvironments,
  useRemoveEnvironmentEndpoint,
  useRemoveRemoteEnvironment,
} from './remote-shell'
