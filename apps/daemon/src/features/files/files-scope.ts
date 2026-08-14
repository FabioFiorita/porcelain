import { hidePath, pinPath, readRepoScope, unhidePath, unpinPath } from '../../stores/scope-store'
import type { FilesScope } from './files-ports'

/** Scope storage adapter; Files operations own the read-plus-filesystem intention. */
export function createFilesScope(): FilesScope {
  return Object.freeze({
    hidePath,
    pinPath,
    read: readRepoScope,
    unhidePath,
    unpinPath,
  })
}
