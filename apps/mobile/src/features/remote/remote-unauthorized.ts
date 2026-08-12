import { configureSession } from '@/lib/daemon/session'

import type { Environment } from './remote-environment'
import { environmentActions } from './remote-environment-store'

/** Credential dead: always land unauthorized; report secure-store delete failure on the state. */
export async function goUnauthorized(environment: Environment): Promise<void> {
  configureSession(null)
  let cleanupError: string | undefined
  try {
    await environmentActions.forgetToken(environment.id)
  } catch (error: unknown) {
    cleanupError = error instanceof Error ? error.message : String(error)
    // Operator channel: persisted revoked token remains on device until cleanup succeeds.
    console.error(
      '[porcelain] secure-store token delete failed after revoke; token may remain on device:',
      cleanupError,
    )
  } finally {
    environmentActions.setConnection(
      cleanupError === undefined
        ? { kind: 'unauthorized' }
        : { kind: 'unauthorized', cleanupError },
    )
  }
}
