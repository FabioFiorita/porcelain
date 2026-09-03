/**
 * Mobile Remote feature public entry point.
 *
 * Settings and other domains import this module only — never a Remote implementation file.
 */

export {
  type ConnectionState,
  currentConnection,
  type EndpointAttempt,
  useConnectionState,
} from './remote-connection'
export {
  activeProjectPathOf,
  type Environment,
  type EnvironmentIcon,
  type EnvironmentId,
  type EnvironmentRecord,
  hostOf,
  isEnabled,
  isPaired,
  normalizeBaseUrl,
  type PairedEnvironment,
  projectNameOf,
} from './remote-environment'
export {
  activeEnvironment,
  environmentActions,
  getEnvironment,
  subscribeToEnvironments,
  useActiveEnvironment,
  useEnvironments,
  useEnvironmentsCorrupt,
} from './remote-environment-store'
export {
  addGroupConnection,
  describePairProblem,
  type PairProblem,
  type PairResult,
  pairNewGroup,
  pairNewGroups,
} from './remote-pair'
export {
  type PairingLink,
  type PairingLinkProblem,
  type ParsedPairingLink,
  parsePairingLink,
  redeemPairingLink,
} from './remote-pairing'

export { recoverToPreferredEndpoint, retryConnection } from './remote-session'

export { goUnauthorized } from './remote-unauthorized'
