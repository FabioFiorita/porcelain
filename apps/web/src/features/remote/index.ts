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
  useSetCloudflareHostname,
  useSetLanBind,
  useSetTailnetBind,
  useTailnetStatus,
} from './remote-settings'
// shell / environments
export {
  type EnvironmentEndpoint,
  type EnvironmentStatus,
  useEnvironmentStatuses,
  useIssueManagedEnvironmentBundle,
  usePairEnvironmentConnection,
  usePreferEnvironmentEndpoint,
  useRemoteEnvironments,
  useRemoveEnvironmentEndpoint,
  useRemoveRemoteEnvironment,
  useRenameEnvironment,
  useSetupWslEnvironment,
  useShellEnvironmentConnections,
  useWslDistributions,
} from './remote-shell'
