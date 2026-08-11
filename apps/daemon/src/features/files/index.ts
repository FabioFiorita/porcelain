/**
 * Files domain public surface for daemon composition.
 * Bound operations + feature router; no global WorkspaceFiles singleton.
 */

export {
  createFilesOperations,
  type FilesOperations,
} from './files-operations'
export { createFilesFeatureRouter } from './files-router'
