// @vitest-environment node
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { describe, expect, it, vi } from 'vitest'
import type { AuthIdentity } from './access-store'
import { createRemoteOperations, type RemoteUpdate } from './remote-operations'
import type {
  RemoteAccess,
  RemoteCloudflare,
  RemoteCloudflareState,
  RemoteIdentityValue,
  RemoteListeners,
  RemoteNetworkConfig,
  RemoteNetworkEnv,
  RemoteNetworkFlags,
  RemoteSessions,
} from './remote-ports'

const GRANT = {
  id: 'pairing-id',
  label: 'Test phone',
  createdAt: '2026-08-09T12:00:00.000Z',
  expiresAt: '2026-08-09T12:15:00.000Z',
  credential: 'pc_pair_pairing-id_secret',
}

const IDENTITY: RemoteIdentityValue = { host: 'workstation', platform: 'linux', arch: 'x64' }

function fakeAccess(overrides: Partial<RemoteAccess> = {}): RemoteAccess {
  return {
    snapshot: vi.fn<RemoteAccess['snapshot']>(async () => ({ pairings: [], clients: [] })),
    issuePairingGrant: vi.fn<RemoteAccess['issuePairingGrant']>(async (label: string) => ({
      ...GRANT,
      label,
    })),
    revokePairingGrant: vi.fn<RemoteAccess['revokePairingGrant']>(async () => false),
    revokeAuthorizedClient: vi.fn<RemoteAccess['revokeAuthorizedClient']>(async () => false),
    ...overrides,
  }
}

function fakeSessions(overrides: Partial<RemoteSessions> = {}): RemoteSessions {
  return {
    clientSessionCount: vi.fn<RemoteSessions['clientSessionCount']>(() => 0),
    closeClientSessions: vi.fn<RemoteSessions['closeClientSessions']>(),
    ...overrides,
  }
}

function fakeConfig(initial: RemoteNetworkFlags = {}): RemoteNetworkConfig {
  let flags: RemoteNetworkFlags = { ...initial }
  return {
    load: vi.fn<RemoteNetworkConfig['load']>(async () => ({ ...flags })),
    update: vi.fn<RemoteNetworkConfig['update']>(async (fn) => {
      flags = fn(flags)
      return { ...flags }
    }),
  }
}

function fakeListeners(overrides: Partial<RemoteListeners> = {}): RemoteListeners {
  return {
    tailnetUrl: vi.fn<RemoteListeners['tailnetUrl']>(() => 'http://workstation.example:43118'),
    tailnetBindError: vi.fn<RemoteListeners['tailnetBindError']>(() => null),
    startTailnetListener: vi.fn<RemoteListeners['startTailnetListener']>(
      async () => 'http://workstation.example:43118',
    ),
    stopTailnetListener: vi.fn<RemoteListeners['stopTailnetListener']>(async () => undefined),
    lanUrl: vi.fn<RemoteListeners['lanUrl']>(() => 'http://workstation.local:43118'),
    lanNumericUrl: vi.fn<RemoteListeners['lanNumericUrl']>(() => 'http://192.168.1.10:43118'),
    lanBindError: vi.fn<RemoteListeners['lanBindError']>(() => null),
    startLanListener: vi.fn<RemoteListeners['startLanListener']>(
      async () => 'http://workstation.local:43118',
    ),
    stopLanListener: vi.fn<RemoteListeners['stopLanListener']>(async () => undefined),
    ifaceListenerPort: vi.fn<RemoteListeners['ifaceListenerPort']>(() => 43118),
    ...overrides,
  }
}

const CLOUDFLARE_OFF: RemoteCloudflareState = {
  enabled: false,
  url: null,
  managed: false,
  error: 'unavailable',
}

const CLOUDFLARE_ON: RemoteCloudflareState = {
  enabled: true,
  url: 'https://random-words-here.trycloudflare.com',
  managed: true,
  error: null,
}

function fakeCloudflare(overrides: Partial<RemoteCloudflare> = {}): RemoteCloudflare {
  return {
    status: vi.fn<RemoteCloudflare['status']>(async () => CLOUDFLARE_OFF),
    start: vi.fn<RemoteCloudflare['start']>(async () => CLOUDFLARE_ON),
    stop: vi.fn<RemoteCloudflare['stop']>(async () => CLOUDFLARE_OFF),
    ...overrides,
  }
}

function fakeEnv(overrides: Partial<RemoteNetworkEnv> = {}): RemoteNetworkEnv {
  return {
    tailnetBindForced: vi.fn<RemoteNetworkEnv['tailnetBindForced']>(() => false),
    lanBindForced: vi.fn<RemoteNetworkEnv['lanBindForced']>(() => false),
    cloudflareBindForced: vi.fn<RemoteNetworkEnv['cloudflareBindForced']>(() => false),
    ...overrides,
  }
}

function operations(
  overrides: {
    access?: Partial<RemoteAccess>
    sessions?: Partial<RemoteSessions>
    identity?: () => RemoteIdentityValue
    version?: () => string
    displayAdminTokenPath?: () => string
    config?: RemoteNetworkConfig
    listeners?: Partial<RemoteListeners>
    cloudflare?: Partial<RemoteCloudflare>
    env?: Partial<RemoteNetworkEnv>
    update?: RemoteUpdate
  } = {},
) {
  const access = fakeAccess(overrides.access)
  const sessions = fakeSessions(overrides.sessions)
  const config = overrides.config ?? fakeConfig()
  const listeners = fakeListeners(overrides.listeners)
  const cloudflare = fakeCloudflare(overrides.cloudflare)
  const env = fakeEnv(overrides.env)
  return {
    access,
    sessions,
    config,
    listeners,
    cloudflare,
    env,
    ops: createRemoteOperations({
      access,
      identity: overrides.identity ?? (() => IDENTITY),
      version: overrides.version ?? (() => '0.52.1'),
      displayAdminTokenPath: overrides.displayAdminTokenPath ?? (() => '~/.porcelain/admin-token'),
      sessions,
      config,
      listeners,
      cloudflare,
      env,
      update: overrides.update,
    }),
  }
}

describe('Remote operations', () => {
  it('composes daemonInfo from version, protocol, and identity', () => {
    const { ops } = operations()
    expect(ops.daemonInfo()).toEqual({
      version: '0.52.1',
      protocolVersion: PROTOCOL_VERSION,
      host: 'workstation',
      platform: 'linux',
      arch: 'x64',
    })
    expect(ops.daemonInfo().protocolVersion).not.toBe(ops.daemonInfo().version)
  })

  it('reports a published version and whether this process can restart itself', async () => {
    const { ops } = operations({
      update: {
        fetchLatest: async () => '0.60.0',
        restartable: () => true,
        restart: vi.fn(async () => undefined),
      },
    })
    await expect(ops.checkDaemonUpdate()).resolves.toEqual({
      currentVersion: '0.52.1',
      latestVersion: '0.60.0',
      restartable: true,
    })
  })

  it('refuses a restart when this process is not the always-on unit', async () => {
    const restart = vi.fn(async () => undefined)
    const { ops } = operations({
      update: {
        fetchLatest: async () => null,
        restartable: () => false,
        restart,
      },
    })
    await expect(ops.restartDaemon()).resolves.toEqual({
      ok: false,
      error: { code: 'resource.unavailable' },
    })
    expect(restart).not.toHaveBeenCalled()
  })

  it('restarts the always-on unit when the host can', async () => {
    const restart = vi.fn(async () => undefined)
    const { ops } = operations({
      update: {
        fetchLatest: async () => '0.60.0',
        restartable: () => true,
        restart,
      },
    })
    await expect(ops.restartDaemon()).resolves.toEqual({ ok: true, value: undefined })
    expect(restart).toHaveBeenCalledTimes(1)
  })

  it('reports a restart launch failure instead of claiming success', async () => {
    const { ops } = operations({
      update: {
        fetchLatest: async () => '0.60.0',
        restartable: () => true,
        restart: vi.fn(async () => {
          throw new Error('systemctl not found')
        }),
      },
    })

    await expect(ops.restartDaemon()).resolves.toEqual({
      ok: false,
      error: { code: 'resource.unavailable' },
    })
  })

  it('joins snapshot, connected count, and admin token path for accessStatus', async () => {
    const snapshot = {
      pairings: [
        {
          id: 'pairing-id',
          label: 'Phone',
          createdAt: GRANT.createdAt,
          expiresAt: GRANT.expiresAt,
        },
      ],
      clients: [{ id: 'client-id', label: 'Phone', createdAt: GRANT.createdAt }],
    }
    const { ops } = operations({
      access: { snapshot: vi.fn(async () => snapshot) },
      sessions: { clientSessionCount: vi.fn(() => 3) },
      displayAdminTokenPath: () => '~/.porcelain-dev/admin-token',
    })

    expect(await ops.accessStatus()).toEqual({
      ...snapshot,
      connected: 3,
      adminTokenPath: '~/.porcelain-dev/admin-token',
    })
  })

  it.each([
    'ftp://example.com',
    'https://user:secret@example.com',
    'https://example.com/?token=secret',
    'https://example.com/#secret',
  ])('refuses %s as request.invalid without issuing a grant', async (baseUrl) => {
    const { access, ops } = operations()

    expect(await ops.issuePairingLink({ label: 'Test phone', baseUrl })).toEqual({
      ok: false,
      error: { code: 'request.invalid' },
    })
    expect(access.issuePairingGrant).not.toHaveBeenCalled()
  })

  it('issues a pairing URL at origin /pair#token=', async () => {
    const { access, ops } = operations()

    expect(
      await ops.issuePairingLink({ label: 'Test phone', baseUrl: 'https://porcelain.example' }),
    ).toEqual({
      ok: true,
      value: {
        ...GRANT,
        label: 'Test phone',
        url: 'https://porcelain.example/pair#token=pc_pair_pairing-id_secret',
      },
    })
    expect(access.issuePairingGrant).toHaveBeenCalledWith('Test phone')
  })

  it('treats unknown pairing revoke as success and never closes sessions', async () => {
    const { access, sessions, ops } = operations()

    expect(await ops.revokePairingLink('missing')).toEqual({ ok: true, value: undefined })
    expect(access.revokePairingGrant).toHaveBeenCalledWith('missing')
    expect(sessions.closeClientSessions).not.toHaveBeenCalled()
  })

  it('closes sessions only when authorized-client revoke removes a client', async () => {
    const closed: string[] = []
    const { ops: noOp } = operations({
      sessions: { closeClientSessions: vi.fn((id: string) => closed.push(id)) },
    })
    expect(await noOp.revokeAuthorizedClient('missing')).toEqual({ ok: true, value: undefined })
    expect(closed).toEqual([])

    const { ops: removed } = operations({
      access: { revokeAuthorizedClient: vi.fn(async () => true) },
      sessions: { closeClientSessions: vi.fn((id: string) => closed.push(id)) },
    })
    expect(await removed.revokeAuthorizedClient('client-id')).toEqual({
      ok: true,
      value: undefined,
    })
    expect(closed).toEqual(['client-id'])
  })

  it('forbids non-client revokeCurrentClient without touching the store', async () => {
    const admin: AuthIdentity = { kind: 'admin' }
    const { access, sessions, ops } = operations()

    expect(await ops.revokeCurrentClient(admin)).toEqual({
      ok: false,
      error: { code: 'auth.forbidden' },
    })
    expect(access.revokeAuthorizedClient).not.toHaveBeenCalled()
    expect(sessions.closeClientSessions).not.toHaveBeenCalled()
  })

  it('composes tailnet and LAN status from flags, env, and listener ports without start/stop', async () => {
    const { listeners, ops } = operations({
      config: fakeConfig({ tailnetBind: true, lanBind: false }),
      listeners: {
        tailnetUrl: vi.fn(() => 'http://100.64.0.2:43118'),
        tailnetBindError: vi.fn(() => null),
        lanUrl: vi.fn(() => null),
        lanNumericUrl: vi.fn(() => null),
        lanBindError: vi.fn(() => 'in-use' as const),
      },
      env: { lanBindForced: vi.fn(() => true) },
    })

    expect(await ops.tailnetStatus()).toEqual({
      enabled: true,
      url: 'http://100.64.0.2:43118',
      error: null,
      envForced: false,
      port: 43118,
    })
    expect(await ops.lanStatus()).toEqual({
      enabled: true,
      url: null,
      numericUrl: null,
      error: 'in-use',
      envForced: true,
      port: 43118,
    })
    expect(listeners.startTailnetListener).not.toHaveBeenCalled()
    expect(listeners.stopTailnetListener).not.toHaveBeenCalled()
    expect(listeners.startLanListener).not.toHaveBeenCalled()
    expect(listeners.stopLanListener).not.toHaveBeenCalled()
  })

  it('writes then starts on setTailnetBind(true) and does not stop', async () => {
    const order: string[] = []
    const config = fakeConfig()
    vi.mocked(config.update).mockImplementation(async (fn) => {
      order.push('update')
      return fn({})
    })
    const { listeners, ops } = operations({
      config,
      listeners: {
        startTailnetListener: vi.fn(async () => {
          order.push('start')
          return 'http://workstation.example:43118'
        }),
      },
    })

    expect(await ops.setTailnetBind(true)).toMatchObject({ enabled: true })
    expect(order).toEqual(['update', 'start'])
    expect(listeners.startTailnetListener).toHaveBeenCalledOnce()
    expect(listeners.stopTailnetListener).not.toHaveBeenCalled()
  })

  it('writes then stops on setLanBind(false) and does not start', async () => {
    const order: string[] = []
    const config = fakeConfig({ lanBind: true })
    vi.mocked(config.update).mockImplementation(async (fn) => {
      order.push('update')
      return fn({ lanBind: true })
    })
    const { listeners, ops } = operations({
      config,
      listeners: {
        stopLanListener: vi.fn(async () => {
          order.push('stop')
        }),
      },
    })

    expect(await ops.setLanBind(false)).toMatchObject({ enabled: false })
    expect(order).toEqual(['update', 'stop'])
    expect(listeners.stopLanListener).toHaveBeenCalledOnce()
    expect(listeners.startLanListener).not.toHaveBeenCalled()
  })

  it('keeps enabled true on set when env is forced even if input is false', async () => {
    const { ops } = operations({
      env: { tailnetBindForced: vi.fn(() => true) },
    })

    expect(await ops.setTailnetBind(false)).toMatchObject({ enabled: true, envForced: true })
  })

  it('passes Cloudflare live state through status and reads a custom hostname', async () => {
    const live: RemoteCloudflareState = {
      enabled: true,
      url: 'https://random-words-here.trycloudflare.com',
      managed: true,
      error: null,
    }
    const config = fakeConfig({
      cloudflareBind: false,
      cloudflareHostname: 'https://porcelain.example.com',
    })
    const { cloudflare, ops } = operations({
      config,
      cloudflare: { status: vi.fn(async () => live) },
      env: { cloudflareBindForced: vi.fn(() => true) },
    })

    expect(await ops.cloudflareStatus()).toEqual({
      ...live,
      customUrl: 'https://porcelain.example.com',
      envForced: true,
    })
    expect(cloudflare.status).toHaveBeenCalledOnce()
    expect(config.load).toHaveBeenCalledOnce()
  })

  it('starts or stops Cloudflare then writes config', async () => {
    const order: string[] = []
    const config = fakeConfig()
    vi.mocked(config.update).mockImplementation(async (fn) => {
      order.push('update')
      return fn({})
    })
    const { cloudflare, ops } = operations({
      config,
      cloudflare: {
        start: vi.fn(async () => {
          order.push('start')
          return CLOUDFLARE_ON
        }),
        stop: vi.fn(async () => {
          order.push('stop')
          return CLOUDFLARE_OFF
        }),
      },
    })

    expect(await ops.setCloudflareBind(true)).toEqual({
      ...CLOUDFLARE_ON,
      customUrl: null,
      envForced: false,
    })
    expect(order).toEqual(['start', 'update'])
    expect(cloudflare.start).toHaveBeenCalledOnce()
    expect(cloudflare.stop).not.toHaveBeenCalled()

    order.length = 0
    expect(await ops.setCloudflareBind(false)).toEqual({
      ...CLOUDFLARE_OFF,
      customUrl: null,
      envForced: false,
    })
    expect(order).toEqual(['stop', 'update'])
    expect(cloudflare.stop).toHaveBeenCalledOnce()
  })

  it('stores an external hostname and stops the other off-network routes', async () => {
    const { cloudflare, config, listeners, ops } = operations({
      config: fakeConfig({ tailnetBind: true }),
    })

    await expect(ops.setCloudflareHostname('https://porcelain.example.com')).resolves.toMatchObject(
      {
        customUrl: 'https://porcelain.example.com',
        enabled: false,
      },
    )
    expect(cloudflare.stop).toHaveBeenCalledOnce()
    expect(listeners.stopTailnetListener).toHaveBeenCalledOnce()
    expect(await config.load()).toMatchObject({
      cloudflareBind: false,
      cloudflareHostname: 'https://porcelain.example.com',
      tailnetBind: false,
    })

    await ops.setCloudflareHostname(null)
    expect(await config.load()).not.toHaveProperty('cloudflareHostname')
  })

  it('turns Tailscale off when Cloudflare starts, and the reverse', async () => {
    const { cloudflare, listeners, config, ops } = operations({
      config: fakeConfig({ tailnetBind: true, cloudflareBind: false }),
    })

    await ops.setCloudflareBind(true)
    expect(listeners.stopTailnetListener).toHaveBeenCalledOnce()
    expect(await config.load()).toMatchObject({ cloudflareBind: true, tailnetBind: false })

    await ops.setTailnetBind(true)
    expect(cloudflare.stop).toHaveBeenCalledOnce()
    expect(await config.load()).toMatchObject({ tailnetBind: true, cloudflareBind: false })
  })

  it('skips config.update when Cloudflare start throws', async () => {
    const config = fakeConfig()
    const { ops } = operations({
      config,
      cloudflare: {
        start: vi.fn(async () => {
          throw new Error('The daemon is not listening yet')
        }),
      },
    })

    await expect(ops.setCloudflareBind(true)).rejects.toThrow('The daemon is not listening yet')
    expect(config.update).not.toHaveBeenCalled()
  })

  it('reads env only through the injected port, never process.env', async () => {
    vi.stubEnv('PORCELAIN_TAILNET_BIND', '1')
    vi.stubEnv('PORCELAIN_LAN_BIND', '1')
    vi.stubEnv('PORCELAIN_CLOUDFLARE_BIND', '1')
    const { ops } = operations({
      config: fakeConfig({ tailnetBind: false, lanBind: false }),
    })

    expect(await ops.tailnetStatus()).toMatchObject({ enabled: false, envForced: false })
    expect(await ops.lanStatus()).toMatchObject({ enabled: false, envForced: false })
    expect(await ops.cloudflareStatus()).toMatchObject({ envForced: false })
    vi.unstubAllEnvs()
  })
})
