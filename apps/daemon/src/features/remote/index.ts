export {
  type AccessSnapshot,
  type AuthIdentity,
  type AuthorizedClient,
  accessSnapshot,
  authenticateClientToken,
  exchangePairingGrant,
  issuePairingGrant,
  type PairingGrant,
  revokeAuthorizedClient,
  revokePairingGrant,
} from './access-store'
export type {
  RemoteOperationError,
  RemoteOperationResult,
  RemoteOperations,
} from './remote-operations'
export { createRemoteOperations } from './remote-operations'
export { createRemoteRouter } from './remote-router'
