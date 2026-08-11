/**
 * Shared Files client semantics (FIL-004).
 *
 * Framework-neutral query identities, runtime-owned mutation/notification effects and
 * foreign tokens, and a declarative interest facade over RT-003. Web and mobile adapters
 * bind these definitions (FIL-005, FIL-006).
 */

export {
  contentPreviewEffects,
  dedupeFilesForeignDependencies,
  dedupeFilesQueryEffects,
  FILES_FOREIGN_CONTENT_INDEX,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_WORKING_TREE,
  type FilesForeignDependency,
  type FilesQueryEffect,
  filesExactEffect,
  filesTreeFamilyEffect,
  treeEffectsForStructuralPath,
  treeSelfEffects,
} from './files-effects'
export {
  createFilesInterest,
  type FilesInterest,
  type FilesInterestHandle,
  type FilesInterestHeld,
  type FilesInterestHost,
} from './files-interests'
export {
  type FilesMutation,
  type FilesMutationDefinition,
  type FilesResultMutationDefinition,
  filesMutations,
} from './files-mutations'
export {
  filesNotificationEffects,
  filesNotificationForeignDependencies,
} from './files-notifications'
export {
  type FileContentQuery,
  type FilePreviewQuery,
  FilesIdentityError,
  type FilesPinsQuery,
  type FilesQuery,
  type FilesScopeQuery,
  type FilesTreeQuery,
  fileContentQuery,
  filePreviewQuery,
  filesPinsQuery,
  filesProjectKey,
  filesScopeQuery,
  filesTreePathsAffectedBy,
  filesTreeQuery,
  isFileContentQuery,
  isFilePreviewQuery,
  isFilesTreeQuery,
  parentFilesPath,
} from './files-queries'
