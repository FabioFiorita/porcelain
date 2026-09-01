/**
 * Web Files feature public entry point.
 *
 * Other Web regions import this module only — never a Files implementation file.
 */

export type { DirEntry, FileView, RepoScope } from '@porcelain/contracts/files'
export { useFilesInterestBridge } from './files-interests'
export {
  applyFilesForeignDependencies,
  useFilesActions,
  useFilesScopeActions,
  useWriteTextFile,
} from './files-mutations'
export {
  applyFilesNotification,
  invalidateAllFiles,
  useFilesNotificationSubscription,
} from './files-notifications'
export {
  normalizeProjectRoot,
  projectAbsoluteFromRelative,
  projectRelativeFromAbsolute,
  treePathFromAbsolute,
} from './files-path'
export {
  useFileContent,
  useFilePreview,
  useFilePreviewSrc,
  useFilesScope,
  useFilesTree,
  usePinnedFiles,
  usePrefetchFileContent,
  useRefreshFilesTree,
  useWorktreeProfile,
  useWorktreeProfileAt,
} from './files-queries'
export {
  filesQueryMatchesEffect,
  invalidateAllFilesQueries,
  invalidateFilesEffects,
} from './files-query-filter'
export {
  filesQueryKey,
  isFilesQueryKey,
  isFilesTreeQueryKey,
} from './files-query-key'
