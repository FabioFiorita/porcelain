import { describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION } from '../protocol'
import { remoteContractFixtures } from './remote.contract'
import { remoteProcedures } from './remote.procedures'

const expectedKinds = {
  daemonInfo: 'query',
  checkDaemonUpdate: 'mutation',
  restartDaemon: 'mutation',
  accessStatus: 'query',
  issuePairingLink: 'mutation',
  revokePairingLink: 'mutation',
  revokeAuthorizedClient: 'mutation',
  revokeCurrentClient: 'mutation',
  tailnetStatus: 'query',
  setTailnetBind: 'mutation',
  lanStatus: 'query',
  setLanBind: 'mutation',
  cloudflareStatus: 'query',
  setCloudflareBind: 'mutation',
  setCloudflareHostname: 'mutation',
} as const

const invalidInputs: Record<keyof typeof remoteProcedures, unknown> = {
  daemonInfo: null,
  checkDaemonUpdate: null,
  restartDaemon: null,
  accessStatus: null,
  issuePairingLink: { label: '', baseUrl: 'not-a-url' },
  revokePairingLink: 42,
  revokeAuthorizedClient: 42,
  revokeCurrentClient: null,
  tailnetStatus: null,
  setTailnetBind: 'true',
  lanStatus: null,
  setLanBind: 'true',
  cloudflareStatus: null,
  setCloudflareBind: 'false',
  setCloudflareHostname: 'http://not-secure.example.com/path',
}

const invalidOutputs: Record<keyof typeof remoteProcedures, unknown> = {
  daemonInfo: { version: '0.52.1', protocolVersion: PROTOCOL_VERSION, platform: 'linux' },
  checkDaemonUpdate: { currentVersion: 1, latestVersion: null, restartable: true },
  restartDaemon: null,
  accessStatus: { pairings: [], clients: [], connected: 0 },
  issuePairingLink: { ...remoteContractFixtures.issuePairingLink.output, credential: undefined },
  revokePairingLink: null,
  revokeAuthorizedClient: null,
  revokeCurrentClient: null,
  tailnetStatus: { ...remoteContractFixtures.tailnetStatus.output, error: 'conflict' },
  setTailnetBind: { ...remoteContractFixtures.setTailnetBind.output, port: '43118' },
  lanStatus: { ...remoteContractFixtures.lanStatus.output, numericUrl: 'not-a-url' },
  setLanBind: { ...remoteContractFixtures.setLanBind.output, enabled: 'true' },
  cloudflareStatus: { ...remoteContractFixtures.cloudflareStatus.output, error: 'busy' },
  setCloudflareBind: { ...remoteContractFixtures.setCloudflareBind.output, managed: 'false' },
  setCloudflareHostname: {
    ...remoteContractFixtures.setCloudflareHostname.output,
    customUrl: 'not-a-url',
  },
}

describe('Remote procedure contracts', () => {
  it('declares all fifteen procedures with their router kinds', () => {
    expect(Object.keys(remoteProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(remoteProcedures[name as keyof typeof remoteProcedures].kind).toBe(kind)
    }
  })

  for (const name of Object.keys(remoteProcedures) as Array<keyof typeof remoteProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = remoteContractFixtures[name]
      const procedure = remoteProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = remoteProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('exposes the shared protocol version on daemon-info and rejects any other value', () => {
    const output = remoteContractFixtures.daemonInfo.output
    expect(output.protocolVersion).toBe(PROTOCOL_VERSION)
    expect(remoteProcedures.daemonInfo.output.parse(output)).toEqual(output)

    for (const malformed of [0, PROTOCOL_VERSION + 1, String(PROTOCOL_VERSION), null, undefined]) {
      expect(
        remoteProcedures.daemonInfo.output.safeParse({ ...output, protocolVersion: malformed })
          .success,
        `${String(malformed)}`,
      ).toBe(false)
    }

    expect(
      remoteProcedures.daemonInfo.output.safeParse({
        version: output.version,
        host: output.host,
        platform: output.platform,
        arch: output.arch,
      }).success,
    ).toBe(false)
  })

  it('rejects unknown fields at the Remote wire boundary', () => {
    expect(
      remoteProcedures.daemonInfo.output.safeParse({
        ...remoteContractFixtures.daemonInfo.output,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      remoteProcedures.accessStatus.output.safeParse({
        ...remoteContractFixtures.accessStatus.output,
        pairings: [
          { id: 'pairing-id', label: 'Device', createdAt: 'now', expiresAt: 'later', extra: true },
        ],
      }).success,
    ).toBe(false)
  })
})
