import { describe, expect, it } from 'vitest'
import { remoteContractFixtures } from './remote.contract'
import { remoteProcedures } from './remote.procedures'

const expectedKinds = {
  daemonInfo: 'query',
  accessStatus: 'query',
  issuePairingLink: 'mutation',
  revokePairingLink: 'mutation',
  revokeAuthorizedClient: 'mutation',
  revokeCurrentClient: 'mutation',
  tailnetStatus: 'query',
  setTailnetBind: 'mutation',
  lanStatus: 'query',
  setLanBind: 'mutation',
  funnelStatus: 'query',
  setFunnelBind: 'mutation',
} as const

const invalidInputs: Record<keyof typeof remoteProcedures, unknown> = {
  daemonInfo: null,
  accessStatus: null,
  issuePairingLink: { label: '', baseUrl: 'not-a-url' },
  revokePairingLink: 42,
  revokeAuthorizedClient: 42,
  revokeCurrentClient: null,
  tailnetStatus: null,
  setTailnetBind: 'true',
  lanStatus: null,
  setLanBind: 'true',
  funnelStatus: null,
  setFunnelBind: 'false',
}

const invalidOutputs: Record<keyof typeof remoteProcedures, unknown> = {
  daemonInfo: { version: '0.52.1', host: 'beelink', platform: 'linux' },
  accessStatus: { pairings: [], clients: [], connected: 0 },
  issuePairingLink: { ...remoteContractFixtures.issuePairingLink.output, credential: undefined },
  revokePairingLink: null,
  revokeAuthorizedClient: null,
  revokeCurrentClient: null,
  tailnetStatus: { ...remoteContractFixtures.tailnetStatus.output, error: 'conflict' },
  setTailnetBind: { ...remoteContractFixtures.setTailnetBind.output, port: '43118' },
  lanStatus: { ...remoteContractFixtures.lanStatus.output, numericUrl: 'not-a-url' },
  setLanBind: { ...remoteContractFixtures.setLanBind.output, enabled: 'true' },
  funnelStatus: { ...remoteContractFixtures.funnelStatus.output, error: 'busy' },
  setFunnelBind: { ...remoteContractFixtures.setFunnelBind.output, managed: 'false' },
}

describe('Remote procedure contracts', () => {
  it('declares all twelve procedures with their router kinds', () => {
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
