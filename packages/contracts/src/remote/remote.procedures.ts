import type { ProcedureContract } from '../procedure-contract'
import type { ProcedureName } from '../procedures/names'
import {
  accessStatusInputSchema,
  accessStatusOutputSchema,
  daemonInfoInputSchema,
  daemonInfoOutputSchema,
  funnelStatusInputSchema,
  funnelStatusOutputSchema,
  issuePairingLinkInputSchema,
  issuePairingLinkOutputSchema,
  lanStatusInputSchema,
  lanStatusOutputSchema,
  revokeAuthorizedClientInputSchema,
  revokeAuthorizedClientOutputSchema,
  revokeCurrentClientInputSchema,
  revokeCurrentClientOutputSchema,
  revokePairingLinkInputSchema,
  revokePairingLinkOutputSchema,
  setFunnelBindInputSchema,
  setFunnelBindOutputSchema,
  setLanBindInputSchema,
  setLanBindOutputSchema,
  setTailnetBindInputSchema,
  setTailnetBindOutputSchema,
  tailnetStatusInputSchema,
  tailnetStatusOutputSchema,
} from './remote.contract'

const remoteProcedureDefinitions = {
  daemonInfo: { kind: 'query', input: daemonInfoInputSchema, output: daemonInfoOutputSchema },
  accessStatus: { kind: 'query', input: accessStatusInputSchema, output: accessStatusOutputSchema },
  issuePairingLink: {
    kind: 'mutation',
    input: issuePairingLinkInputSchema,
    output: issuePairingLinkOutputSchema,
  },
  revokePairingLink: {
    kind: 'mutation',
    input: revokePairingLinkInputSchema,
    output: revokePairingLinkOutputSchema,
  },
  revokeAuthorizedClient: {
    kind: 'mutation',
    input: revokeAuthorizedClientInputSchema,
    output: revokeAuthorizedClientOutputSchema,
  },
  revokeCurrentClient: {
    kind: 'mutation',
    input: revokeCurrentClientInputSchema,
    output: revokeCurrentClientOutputSchema,
  },
  tailnetStatus: {
    kind: 'query',
    input: tailnetStatusInputSchema,
    output: tailnetStatusOutputSchema,
  },
  setTailnetBind: {
    kind: 'mutation',
    input: setTailnetBindInputSchema,
    output: setTailnetBindOutputSchema,
  },
  lanStatus: { kind: 'query', input: lanStatusInputSchema, output: lanStatusOutputSchema },
  setLanBind: { kind: 'mutation', input: setLanBindInputSchema, output: setLanBindOutputSchema },
  funnelStatus: { kind: 'query', input: funnelStatusInputSchema, output: funnelStatusOutputSchema },
  setFunnelBind: {
    kind: 'mutation',
    input: setFunnelBindInputSchema,
    output: setFunnelBindOutputSchema,
  },
} as const

export type RemoteProcedureName = Extract<keyof typeof remoteProcedureDefinitions, ProcedureName>

export const remoteProcedures = remoteProcedureDefinitions satisfies Record<
  RemoteProcedureName,
  ProcedureContract
>
