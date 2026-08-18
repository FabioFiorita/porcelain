import { createScopeStore, type ScopeStoreOptions } from '../../stores/scope-store'
import type { FilesScope } from './files-ports'

/** Scope storage adapter; Files operations own the read-plus-filesystem intention. */
export function createFilesScope(options?: ScopeStoreOptions): FilesScope {
  if (options === undefined) {
    return Object.freeze({
      hidePath: async () => undefined,
      pinPath: async () => undefined,
      read: async () => ({ hiddenPaths: [], pinnedPaths: [] }),
      // No store configured: an unregistered checkout is a plain tree with no
      // profile, which is exactly the empty view rather than an error.
      readProfile: async () => ({
        worktreeId: null,
        base: { hiddenPaths: [], pinnedPaths: [], layers: [] },
        override: null,
        resolved: { hiddenPaths: [], pinnedPaths: [], layers: [] },
      }),
      unhidePath: async () => undefined,
      unpinPath: async () => undefined,
    })
  }
  const scope = createScopeStore(options)
  return Object.freeze({
    hidePath: scope.hidePath,
    pinPath: scope.pinPath,
    read: scope.readRepoScope,
    readProfile: scope.profileViewForRepo,
    unhidePath: scope.unhidePath,
    unpinPath: scope.unpinPath,
  })
}
