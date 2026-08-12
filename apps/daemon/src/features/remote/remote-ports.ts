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

export type RemoteNetworkFlags = {
  tailnetBind?: boolean
  lanBind?: boolean
  funnelBind?: boolean
}

export type RemoteNetworkConfig = {
  load(): Promise<RemoteNetworkFlags>
  update(fn: (current: RemoteNetworkFlags) => RemoteNetworkFlags): Promise<RemoteNetworkFlags>
}

export type RemoteListeners = {
  tailnetUrl(): string | null
  tailnetBindError(): 'in-use' | null
  startTailnetListener(): Promise<string | null>
  stopTailnetListener(): Promise<void>
  lanUrl(): string | null
  lanNumericUrl(): string | null
  lanBindError(): 'in-use' | null
  startLanListener(): Promise<string | null>
  stopLanListener(): Promise<void>
  ifaceListenerPort(): number
}

export type RemoteFunnelState = {
  enabled: boolean
  url: string | null
  managed: boolean
  error: 'unavailable' | 'conflict' | null
}

export type RemoteFunnel = {
  status(): Promise<RemoteFunnelState>
  start(): Promise<RemoteFunnelState>
  stop(): Promise<RemoteFunnelState>
}

export type RemoteNetworkEnv = {
  tailnetBindForced(): boolean
  lanBindForced(): boolean
  funnelBindForced(): boolean
}
