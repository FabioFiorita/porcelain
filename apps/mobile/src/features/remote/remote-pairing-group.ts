import { remoteProcedures } from '@porcelain/contracts/remote'

import { recentProjectsProcedure } from '@/features/projects'
import { createDaemonClient } from '@/lib/daemon/client'
import { callDaemon, namedContractProcedure } from '@/lib/daemon/procedure'

const revokeCurrentClient = namedContractProcedure(
  'revokeCurrentClient',
  remoteProcedures.revokeCurrentClient,
)

/** Verify a newly issued credential before saving it as a group connection. */
export async function verifyPairingCredential(baseUrl: string, token: string): Promise<void> {
  try {
    await callDaemon(createDaemonClient(baseUrl, token), recentProjectsProcedure, {
      includeWorktrees: true,
    })
  } catch (cause) {
    await discardPairingCredential(baseUrl, token)
    throw cause
  }
}

/**
 * Prove that a newly paired route belongs to an existing group, then remove the temporary
 * credential. The existing group token is the identity proof; a hostname is only a label.
 */
export async function attachPairingCredential(
  baseUrl: string,
  pairingToken: string,
  groupToken: string,
): Promise<void> {
  await verifyPairingCredential(baseUrl, pairingToken)
  try {
    await callDaemon(createDaemonClient(baseUrl, groupToken), recentProjectsProcedure, {
      includeWorktrees: true,
    })
  } catch (cause) {
    await discardPairingCredential(baseUrl, pairingToken)
    throw new Error('That connection does not belong to the selected environment group', {
      cause,
    })
  }
  await callDaemon(createDaemonClient(baseUrl, pairingToken), revokeCurrentClient, undefined)
}

/** Best-effort cleanup when a one-shot pairing credential cannot be saved. */
export async function discardPairingCredential(baseUrl: string, token: string): Promise<void> {
  try {
    await callDaemon(createDaemonClient(baseUrl, token), revokeCurrentClient, undefined)
  } catch {
    // The endpoint may disappear while cleanup runs; the original pairing error is clearer.
  }
}
