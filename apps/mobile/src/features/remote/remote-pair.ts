import { parsePublicError } from '@porcelain/client-runtime/remote'
import { isPairingBundleLink, parsePairingBundleLink } from '@porcelain/contracts/remote'

import { type EnvironmentId, hostOf, type PairedEnvironment } from './remote-environment'
import { environmentActions, getEnvironment } from './remote-environment-store'
import { type PairingLinkProblem, parsePairingLink, redeemPairingLink } from './remote-pairing'
import {
  attachPairingCredential,
  discardPairingCredential,
  verifyPairingCredential,
} from './remote-pairing-group'

export type PairProblem =
  | { kind: 'link'; problem: PairingLinkProblem }
  | { kind: 'daemon'; message: string }
  | { kind: 'mismatch'; message: string }

export type PairResult<T> = { ok: true; value: T } | { ok: false; error: PairProblem }

function pairingLinkMessage(problem: PairingLinkProblem): string {
  switch (problem) {
    case 'empty':
      return 'Paste a connection link from the host Share settings.'
    case 'malformed':
      return 'That does not look like a Porcelain connection link.'
    case 'missing-token':
      return 'The link is missing its pairing token.'
    case 'foreign-token':
      return 'That token is a client credential, not a one-shot pairing link.'
  }
}

export function describePairProblem(error: PairProblem): string {
  if (error.kind === 'link') return pairingLinkMessage(error.problem)
  return error.message
}

function toDaemonProblem(error: unknown): PairProblem {
  const parsed = parsePublicError(error)
  if (parsed.kind === 'update-required') {
    return { kind: 'daemon', message: parsed.error.message }
  }
  if (parsed.kind === 'public') {
    if (parsed.error.code === 'auth.unauthenticated' || parsed.error.code === 'auth.forbidden') {
      return { kind: 'daemon', message: 'That pairing link was already used or expired.' }
    }
    return { kind: 'daemon', message: parsed.error.message }
  }
  if (error instanceof Error && error.message.length > 0) {
    return { kind: 'mismatch', message: error.message }
  }
  return { kind: 'daemon', message: 'Pairing failed.' }
}

/**
 * Create a new environment group from a connection link. The link becomes the primary
 * route; nickname falls back to the host when left blank.
 */
export async function pairNewGroup(input: {
  connectionLink: string
  nickname?: string
}): Promise<PairResult<PairedEnvironment>> {
  const parsed = parsePairingLink(input.connectionLink)
  if (!parsed.ok) return { ok: false, error: { kind: 'link', problem: parsed.problem } }

  try {
    const token = await redeemPairingLink(parsed.link)
    await verifyPairingCredential(parsed.link.baseUrl, token)
    const nickname = input.nickname?.trim() || hostOf(parsed.link.baseUrl) || 'Environment'
    const environment = await environmentActions.add({
      baseUrl: parsed.link.baseUrl,
      nickname,
      token,
    })
    return { ok: true, value: environment }
  } catch (error) {
    return { ok: false, error: toDaemonProblem(error) }
  }
}

/**
 * Import one ordinary link or a desktop bundle containing one independently-issued link per
 * Environment. Credentials stay separate; the bundle removes repeated paste/switch work only.
 */
export async function pairNewGroups(input: {
  connectionLink: string
  nickname?: string
}): Promise<PairResult<readonly PairedEnvironment[]>> {
  const bundle = parsePairingBundleLink(input.connectionLink)
  if (bundle === null) {
    if (isPairingBundleLink(input.connectionLink)) {
      return { ok: false, error: { kind: 'link', problem: 'malformed' } }
    }
    const single = await pairNewGroup(input)
    return single.ok ? { ok: true, value: [single.value] } : single
  }

  const paired: PairedEnvironment[] = []
  for (const entry of bundle.environments) {
    const result = await pairNewGroup({ connectionLink: entry.url, nickname: entry.name })
    if (!result.ok) {
      // A later daemon can disappear after an earlier link was redeemed. Remove any local
      // partial import and revoke those newly-created daemon credentials best-effort.
      await Promise.all(
        paired.map(async (environment) => {
          await discardPairingCredential(environment.baseUrl, environment.token)
          await environmentActions.remove(environment.id)
        }),
      )
      return result
    }
    paired.push(result.value)
  }
  return { ok: true, value: paired }
}

/**
 * Add a verified route to an existing group. The temporary pairing credential is revoked
 * after the group's existing token authenticates at the new URL.
 */
export async function addGroupConnection(input: {
  groupId: EnvironmentId
  connectionLink: string
}): Promise<PairResult<void>> {
  const parsed = parsePairingLink(input.connectionLink)
  if (!parsed.ok) return { ok: false, error: { kind: 'link', problem: parsed.problem } }

  const group = getEnvironment(input.groupId)
  if (group === null) {
    return { ok: false, error: { kind: 'mismatch', message: 'That environment no longer exists.' } }
  }
  if (group.token === null) {
    return {
      ok: false,
      error: {
        kind: 'mismatch',
        message: 'This group needs to be re-paired before adding routes.',
      },
    }
  }

  try {
    const pairingToken = await redeemPairingLink(parsed.link)
    await attachPairingCredential(parsed.link.baseUrl, pairingToken, group.token)
    await environmentActions.addEndpoint(input.groupId, parsed.link.baseUrl)
    return { ok: true, value: undefined }
  } catch (error) {
    return { ok: false, error: toDaemonProblem(error) }
  }
}
