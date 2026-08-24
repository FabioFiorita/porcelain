import { PROTOCOL_VERSION } from '@porcelain/contracts'
import type {
  AccessStatusOutput,
  CheckDaemonUpdateOutput,
  CloudflareStatusOutput,
  DaemonInfoOutput,
  IssuePairingLinkInput,
  IssuePairingLinkOutput,
  LanStatusOutput,
  TailnetStatusOutput,
} from '@porcelain/contracts/remote'
import {
  type AuthIdentity,
  accessSnapshot,
  issuePairingGrant,
  revokePairingGrant,
  revokeAuthorizedClient as storeRevokeAuthorizedClient,
} from './access-store'
import { daemonRestartable, fetchPublishedVersion, restartPorcelainService } from './daemon-update'
import type {
  RemoteAccess,
  RemoteCloudflare,
  RemoteIdentityValue,
  RemoteListeners,
  RemoteNetworkConfig,
  RemoteNetworkEnv,
  RemoteOperationError,
  RemoteOperationResult,
  RemoteSessions,
} from './remote-ports'

export type { RemoteOperationError, RemoteOperationResult }

export type RemoteUpdate = {
  fetchLatest(): Promise<string | null>
  restartable(): boolean
  restart(): void
}

export type RemoteOperations = Readonly<{
  daemonInfo: () => DaemonInfoOutput
  checkDaemonUpdate: () => Promise<CheckDaemonUpdateOutput>
  restartDaemon: () => Promise<RemoteOperationResult<void>>
  accessStatus: () => Promise<AccessStatusOutput>
  issuePairingLink: (
    input: IssuePairingLinkInput,
  ) => Promise<RemoteOperationResult<IssuePairingLinkOutput>>
  revokePairingLink: (id: string) => Promise<RemoteOperationResult<void>>
  revokeAuthorizedClient: (id: string) => Promise<RemoteOperationResult<void>>
  revokeCurrentClient: (auth: AuthIdentity) => Promise<RemoteOperationResult<void>>
  tailnetStatus: () => Promise<TailnetStatusOutput>
  setTailnetBind: (input: boolean) => Promise<TailnetStatusOutput>
  lanStatus: () => Promise<LanStatusOutput>
  setLanBind: (input: boolean) => Promise<LanStatusOutput>
  cloudflareStatus: () => Promise<CloudflareStatusOutput>
  setCloudflareBind: (input: boolean) => Promise<CloudflareStatusOutput>
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
  config: RemoteNetworkConfig
  listeners: RemoteListeners
  cloudflare: RemoteCloudflare
  env: RemoteNetworkEnv
  update?: RemoteUpdate
}): RemoteOperations {
  const update: RemoteUpdate = options.update ?? {
    fetchLatest: fetchPublishedVersion,
    restartable: daemonRestartable,
    restart: restartPorcelainService,
  }
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

    async checkDaemonUpdate(): Promise<CheckDaemonUpdateOutput> {
      return {
        currentVersion: options.version(),
        latestVersion: await update.fetchLatest(),
        restartable: update.restartable(),
      }
    },

    async restartDaemon(): Promise<RemoteOperationResult<void>> {
      if (!update.restartable()) {
        return { ok: false, error: { code: 'resource.unavailable' } }
      }
      update.restart()
      return { ok: true, value: undefined }
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

    async tailnetStatus(): Promise<TailnetStatusOutput> {
      const flags = await options.config.load()
      const envForced = options.env.tailnetBindForced()
      return {
        enabled: flags.tailnetBind === true || envForced,
        url: options.listeners.tailnetUrl(),
        error: options.listeners.tailnetBindError(),
        envForced,
        port: options.listeners.ifaceListenerPort(),
      }
    },

    async setTailnetBind(input: boolean): Promise<TailnetStatusOutput> {
      if (input) await options.cloudflare.stop()
      await options.config.update((current) => ({
        ...current,
        tailnetBind: input,
        cloudflareBind: input ? false : current.cloudflareBind,
      }))
      if (input) await options.listeners.startTailnetListener()
      else await options.listeners.stopTailnetListener()
      const envForced = options.env.tailnetBindForced()
      return {
        enabled: input || envForced,
        url: options.listeners.tailnetUrl(),
        error: options.listeners.tailnetBindError(),
        envForced,
        port: options.listeners.ifaceListenerPort(),
      }
    },

    async lanStatus(): Promise<LanStatusOutput> {
      const flags = await options.config.load()
      const envForced = options.env.lanBindForced()
      return {
        enabled: flags.lanBind === true || envForced,
        url: options.listeners.lanUrl(),
        numericUrl: options.listeners.lanNumericUrl(),
        error: options.listeners.lanBindError(),
        envForced,
        port: options.listeners.ifaceListenerPort(),
      }
    },

    async setLanBind(input: boolean): Promise<LanStatusOutput> {
      await options.config.update((current) => ({ ...current, lanBind: input }))
      if (input) await options.listeners.startLanListener()
      else await options.listeners.stopLanListener()
      const envForced = options.env.lanBindForced()
      return {
        enabled: input || envForced,
        url: options.listeners.lanUrl(),
        numericUrl: options.listeners.lanNumericUrl(),
        error: options.listeners.lanBindError(),
        envForced,
        port: options.listeners.ifaceListenerPort(),
      }
    },

    async cloudflareStatus(): Promise<CloudflareStatusOutput> {
      return {
        ...(await options.cloudflare.status()),
        envForced: options.env.cloudflareBindForced(),
      }
    },

    async setCloudflareBind(input: boolean): Promise<CloudflareStatusOutput> {
      const status = input ? await options.cloudflare.start() : await options.cloudflare.stop()
      if (input) await options.listeners.stopTailnetListener()
      await options.config.update((current) => ({
        ...current,
        cloudflareBind: input,
        tailnetBind: input ? false : current.tailnetBind,
      }))
      return { ...status, envForced: options.env.cloudflareBindForced() }
    },
  })
}
