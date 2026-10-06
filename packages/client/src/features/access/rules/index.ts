export { parsePairingLink, type PairingCode } from './pairing-link.ts';
export {
  sameRemoteConnection,
  remoteStatusText,
  remoteStatusNote,
  remoteStatus,
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
  type ServiceUpdate,
} from './service-update.ts';
export type { BrowserSession } from './browser-session.ts';
