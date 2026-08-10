import type { ProcedureContract } from '../procedure-contract'
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
  daemonInfo: {
    kind: 'query',
    input: daemonInfoInputSchema,
    output: daemonInfoOutputSchema,
    errors: [],
  },
  accessStatus: {
    kind: 'query',
    input: accessStatusInputSchema,
    output: accessStatusOutputSchema,
    errors: ['auth.forbidden'],
  },
  issuePairingLink: {
    kind: 'mutation',
    input: issuePairingLinkInputSchema,
    output: issuePairingLinkOutputSchema,
    errors: ['auth.forbidden', 'request.invalid'],
  },
  revokePairingLink: {
    kind: 'mutation',
    input: revokePairingLinkInputSchema,
    output: revokePairingLinkOutputSchema,
    errors: ['auth.forbidden'],
  },
  revokeAuthorizedClient: {
    kind: 'mutation',
    input: revokeAuthorizedClientInputSchema,
    output: revokeAuthorizedClientOutputSchema,
    errors: ['auth.forbidden'],
  },
  revokeCurrentClient: {
    kind: 'mutation',
    input: revokeCurrentClientInputSchema,
    output: revokeCurrentClientOutputSchema,
    errors: ['auth.forbidden'],
  },
  tailnetStatus: {
    kind: 'query',
    input: tailnetStatusInputSchema,
    output: tailnetStatusOutputSchema,
    errors: ['auth.forbidden'],
  },
  setTailnetBind: {
    kind: 'mutation',
    input: setTailnetBindInputSchema,
    output: setTailnetBindOutputSchema,
    errors: ['auth.forbidden'],
  },
  lanStatus: {
    kind: 'query',
    input: lanStatusInputSchema,
    output: lanStatusOutputSchema,
    errors: ['auth.forbidden'],
  },
  setLanBind: {
    kind: 'mutation',
    input: setLanBindInputSchema,
    output: setLanBindOutputSchema,
    errors: ['auth.forbidden'],
  },
  funnelStatus: {
    kind: 'query',
    input: funnelStatusInputSchema,
    output: funnelStatusOutputSchema,
    errors: ['auth.forbidden'],
  },
  setFunnelBind: {
    kind: 'mutation',
    input: setFunnelBindInputSchema,
    output: setFunnelBindOutputSchema,
    errors: ['auth.forbidden'],
  },
} as const

export type RemoteProcedureName = keyof typeof remoteProcedureDefinitions

export const remoteProcedures = remoteProcedureDefinitions satisfies Record<
  RemoteProcedureName,
  ProcedureContract
>
