import type { SessionChange } from '@porcelain/contracts/session'
import { type BoardOperations, createBoardOperations } from '../features/board'
import { publishSessionChange } from '../session/live-session'

/**
 * Process-wide bound operation catalog constructed once at daemon startup.
 * Each domain migration adds a required non-optional property and converts its
 * router factory to receive that narrow slice in the same change.
 */
export type DaemonOperations = Readonly<{
  board: BoardOperations
}>

export interface CreateDaemonRouterOptions {
  operations: DaemonOperations
}

export function createDaemonOperations(options?: {
  publishSessionChange?: (change: SessionChange) => void
}): DaemonOperations {
  return Object.freeze({
    board: createBoardOperations({
      publishSessionChange: options?.publishSessionChange ?? publishSessionChange,
    }),
  })
}
