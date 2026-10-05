export {
  parsePairingLink,
  remoteLink,
  type PairingCode,
} from './pairing-link.ts';
export {
  remoteKey,
  syncRemoteConnections,
  remoteStatusText,
  remoteStatusNote,
  remoteStatus,
  parseRemotes,
  type Remote,
  type RemoteStatus,
} from './remotes.ts';
export {
  connectionErrorMessage,
  UNSAVED_DRAFTS_MESSAGE,
} from './connection-error-message.ts';
export {
  deviceRouteTitles,
  issuedLink,
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
