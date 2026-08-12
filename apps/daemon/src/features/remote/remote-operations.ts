import { PROTOCOL_VERSION } from '@porcelain/contracts'
import type {
  AccessStatusOutput,
  DaemonInfoOutput,
  IssuePairingLinkInput,
  IssuePairingLinkOutput,
} from '@porcelain/contracts/remote'
import {
  type AuthIdentity,
  accessSnapshot,
  issuePairingGrant,
  revokePairingGrant,
  revokeAuthorizedClient as storeRevokeAuthorizedClient,
} from './access-store'
import type {
  RemoteAccess,
  RemoteIdentityValue,
  RemoteOperationError,
  RemoteOperationResult,
  RemoteSessions,
} from './remote-ports'

export type { RemoteOperationError, RemoteOperationResult }

export type RemoteOperations = Readonly<{
  daemonInfo: () => DaemonInfoOutput
  accessStatus: () => Promise<AccessStatusOutput>
  issuePairingLink: (
    input: IssuePairingLinkInput,
  ) => Promise<RemoteOperationResult<IssuePairingLinkOutput>>
  revokePairingLink: (id: string) => Promise<RemoteOperationResult<void>>
  revokeAuthorizedClient: (id: string) => Promise<RemoteOperationResult<void>>
  revokeCurrentClient: (auth: AuthIdentity) => Promise<RemoteOperationResult<void>>
}>

function invalid(): RemoteOperationResult<never> {
  return { ok: false, error: { code: 'request.invalid' } }
}

export function createRemoteOperations(options: {
  access?: RemoteAccess
  identity: () => RemoteIdentityValue
  version: () => string
  displayAdminTokenPath: () => string
  sessions: RemoteSessions
}): RemoteOperations {
  const access = options.access ?? {
    snapshot: accessSnapshot,
    issuePairingGrant,
    revokePairingGrant,
    revokeAuthorizedClient: storeRevokeAuthorizedClient,
  }

  return Object.freeze({
    daemonInfo(): DaemonInfoOutput {
      return {
        version: options.version(),
        protocolVersion: PROTOCOL_VERSION,
        ...options.identity(),
      }
    },

    async accessStatus(): Promise<AccessStatusOutput> {
      return {
        ...(await access.snapshot()),
        connected: options.sessions.clientSessionCount(),
        adminTokenPath: options.displayAdminTokenPath(),
      }
    },

    async issuePairingLink(
      input: IssuePairingLinkInput,
    ): Promise<RemoteOperationResult<IssuePairingLinkOutput>> {
      let base: URL
      try {
        base = new URL(input.baseUrl)
      } catch {
        return invalid()
      }
      if (base.protocol !== 'http:' && base.protocol !== 'https:') {
        return invalid()
      }
      if (base.username !== '' || base.password !== '' || base.search !== '' || base.hash !== '') {
        return invalid()
      }
      base.pathname = '/pair'
      const grant = await access.issuePairingGrant(input.label)
      base.hash = new URLSearchParams([['token', grant.credential]]).toString()
      return { ok: true, value: { ...grant, url: base.toString() } }
    },

    async revokePairingLink(id: string): Promise<RemoteOperationResult<void>> {
      await access.revokePairingGrant(id)
      return { ok: true, value: undefined }
    },

    async revokeAuthorizedClient(id: string): Promise<RemoteOperationResult<void>> {
      if (await access.revokeAuthorizedClient(id)) {
        options.sessions.closeClientSessions(id)
      }
      return { ok: true, value: undefined }
    },

    async revokeCurrentClient(auth: AuthIdentity): Promise<RemoteOperationResult<void>> {
      if (auth.kind !== 'client') {
        return { ok: false, error: { code: 'auth.forbidden' } }
      }
      if (await access.revokeAuthorizedClient(auth.clientId)) {
        options.sessions.closeClientSessions(auth.clientId)
      }
      return { ok: true, value: undefined }
    },
  })
}
