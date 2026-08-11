/**
 * Process-wide bound operation catalog constructed once at daemon startup.
 * Empty until each domain migration adds a required non-optional property and
 * converts its router factory to receive that narrow slice in the same change.
 */
export type DaemonOperations = Readonly<Record<never, never>>

export interface CreateDaemonRouterOptions {
  operations: DaemonOperations
}

export function createDaemonOperations(): DaemonOperations {
  return Object.freeze({})
}
