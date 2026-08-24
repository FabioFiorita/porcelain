import type { ProcedureContract } from '../procedure-contract'
import {
  accessStatusInputSchema,
  accessStatusOutputSchema,
  checkDaemonUpdateInputSchema,
  checkDaemonUpdateOutputSchema,
  cloudflareStatusInputSchema,
  cloudflareStatusOutputSchema,
  daemonInfoInputSchema,
  daemonInfoOutputSchema,
  issuePairingLinkInputSchema,
  issuePairingLinkOutputSchema,
  lanStatusInputSchema,
  lanStatusOutputSchema,
  revokeAuthorizedClientInputSchema,
  revokeAuthorizedClientOutputSchema,
  revokeCurrentClientInputSchema,
  revokeCurrentClientOutputSchema,
  restartDaemonInputSchema,
  restartDaemonOutputSchema,
  revokePairingLinkInputSchema,
  revokePairingLinkOutputSchema,
  setCloudflareBindInputSchema,
  setCloudflareBindOutputSchema,
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
  checkDaemonUpdate: {
    kind: 'mutation',
    input: checkDaemonUpdateInputSchema,
    output: checkDaemonUpdateOutputSchema,
    errors: [],
  },
  restartDaemon: {
    kind: 'mutation',
    input: restartDaemonInputSchema,
    output: restartDaemonOutputSchema,
    errors: ['resource.unavailable'],
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
  cloudflareStatus: {
    kind: 'query',
    input: cloudflareStatusInputSchema,
    output: cloudflareStatusOutputSchema,
    errors: ['auth.forbidden'],
  },
  setCloudflareBind: {
    kind: 'mutation',
    input: setCloudflareBindInputSchema,
    output: setCloudflareBindOutputSchema,
    errors: ['auth.forbidden'],
  },
} as const

export type RemoteProcedureName = keyof typeof remoteProcedureDefinitions

export const remoteProcedures = remoteProcedureDefinitions satisfies Record<
  RemoteProcedureName,
  ProcedureContract
>
