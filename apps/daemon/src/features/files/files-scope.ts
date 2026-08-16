import { createScopeStore, type ScopeStoreOptions } from '../../stores/scope-store'
import type { FilesScope } from './files-ports'

/** Scope storage adapter; Files operations own the read-plus-filesystem intention. */
export function createFilesScope(options?: ScopeStoreOptions): FilesScope {
  if (options === undefined) {
    return Object.freeze({
      hidePath: async () => undefined,
      pinPath: async () => undefined,
      read: async () => ({ hiddenPaths: [], pinnedPaths: [] }),
      unhidePath: async () => undefined,
      unpinPath: async () => undefined,
    })
  }
  const scope = createScopeStore(options)
  return Object.freeze({
    hidePath: scope.hidePath,
    pinPath: scope.pinPath,
    read: scope.readRepoScope,
    unhidePath: scope.unhidePath,
    unpinPath: scope.unpinPath,
  })
}
