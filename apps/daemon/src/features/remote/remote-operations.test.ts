// @vitest-environment node
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { describe, expect, it, vi } from 'vitest'
import type { AuthIdentity } from './access-store'
import { createRemoteOperations } from './remote-operations'
import type { RemoteAccess, RemoteIdentityValue, RemoteSessions } from './remote-ports'

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
    snapshot: vi.fn(async () => ({ pairings: [], clients: [] })),
    issuePairingGrant: vi.fn(async (label: string) => ({ ...GRANT, label })),
    revokePairingGrant: vi.fn(async () => false),
    revokeAuthorizedClient: vi.fn(async () => false),
    ...overrides,
  }
}

function fakeSessions(overrides: Partial<RemoteSessions> = {}): RemoteSessions {
  return {
    clientSessionCount: vi.fn(() => 0),
    closeClientSessions: vi.fn(),
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
  } = {},
) {
  const access = fakeAccess(overrides.access)
  const sessions = fakeSessions(overrides.sessions)
  return {
    access,
    sessions,
    ops: createRemoteOperations({
      access,
      identity: overrides.identity ?? (() => IDENTITY),
      version: overrides.version ?? (() => '0.52.1'),
      displayAdminTokenPath: overrides.displayAdminTokenPath ?? (() => '~/.porcelain/admin-token'),
      sessions,
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
})
