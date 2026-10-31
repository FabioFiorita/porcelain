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
  ANDROID_EMULATOR_HOST,
  deviceRouteTitles,
  LOCAL_NETWORK_WARNING,
  hostnameForm,
  localNetworkNote,
  networkName,
  pairingAddresses,
  protectedRouteNote,
  remoteRouteDescriptions,
  remoteRouteNames,
  remoteRouteTitles,
  routeFailure,
  routeStatusLabel,
  tailscaleServeCommand,
  type Environment,
  type HostnameFormInput,
  type PairedAccess,
  type RemoteAccess,
  type RemoteAccessChange,
  type RemoteRoute,
  type RemoteRouteName,
  waysInPermissionShown,
  waysInRefusal,
} from './share.ts';
export {
  serviceUpdateOutcome,
  serviceUpdateProgress,
} from './service-update.ts';
export type { BrowserSession } from './browser-session.ts';
export {
  chosenEnvironmentIcon,
  environmentIcon,
  environmentIconLabels,
  environmentIcons,
  type EnvironmentIcon,
} from './environment-icon.ts';
