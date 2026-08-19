/**
 * Files domain public surface for daemon composition.
 * Bound operations + feature router + per-session watch factory;
 * no global WorkspaceFiles singleton.
 */

export {
  createFilesOperations,
  type FilesOperations,
} from './files-operations'
export {
  createFilePreviewTokens,
  type FilePreviewAccessScope,
  type FilePreviewTokens,
} from './file-preview-tokens'
export { createFilesFeatureRouter } from './files-router'
export { createFilesScope } from './files-scope'
export {
  createSessionFilesWatches,
  type SessionFilesWatches,
} from './files-watches'
