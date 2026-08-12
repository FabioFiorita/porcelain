import type { AccessSnapshot, PairingGrant } from './access-store'

export type RemoteAccess = {
  snapshot(): Promise<AccessSnapshot>
  issuePairingGrant(label: string, now?: number): Promise<PairingGrant & { credential: string }>
  revokePairingGrant(id: string): Promise<boolean>
  revokeAuthorizedClient(id: string): Promise<boolean>
}

export type RemoteSessions = {
  clientSessionCount(): number
  closeClientSessions(clientId: string): void
}

export type RemoteIdentityValue = {
  host: string
  platform: string
  arch: string
}

export type RemoteOperationError =
  | { readonly code: 'request.invalid' }
  | { readonly code: 'auth.forbidden' }

export type RemoteOperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteOperationError }
