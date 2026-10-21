export { parsePairingLink, type PairingCode } from './pairing-link.ts';
export {
  connectionRoutes,
  operationJournalKey,
  connectionRouteTitle,
  type ConnectionRoute,
  sameRemoteConnection,
  remoteStatusText,
  remoteStatusNote,
  parseRemotes,
  serializeRemotes,
  type Remote,
  type RemoteStatus,
} from './remotes.ts';
export { connectionErrorMessage } from './connection-error-message.ts';
export {
  deviceRouteTitles,
  localNetworkNote,
  networkName,
  pairingAddresses,
  remoteRouteTitles,
  routeFailure,
  tailscaleServeCommand,
  type Environment,
  type RemoteAccess,
  type RemoteRoute,
  type RemoteRouteName,
} from './share.ts';
export {
  serviceUpdateOutcome,
  serviceUpdateProgress,
} from './service-update.ts';
export type { BrowserSession } from './browser-session.ts';
