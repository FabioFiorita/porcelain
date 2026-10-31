export {
  canDropPaths,
  directoryPaths,
  duplicatePath,
  entryName,
  entryTreeActions,
  nextCreatePath,
  selectedDirectories,
  type TreeAction,
} from './tree-actions.ts';
export { type FilesScope } from './scope.ts';
export { fileErrorMessage, surfaceErrorMessage } from './error-message.ts';
export {
  fileTreeAncestors,
  fileTreeExpansion,
  mergeFileTreeEntries,
  visibleFileTreeRows,
  type FileTreeEntry,
} from './file-tree.ts';
export { quickOpenMatches, quickOpenPath } from './quick-open.ts';
export { isImagePath } from './image-path.ts';
export {
  branchChangeMarks,
  changeStatus,
  changeStatusMarks,
  worktreeChangeMarks,
  type FileChangeMarks,
} from './change-marks.ts';

export {
  canonicalPreferencePath,
  hiddenPathFor,
  hiddenSummary,
  visibleFileTreePaths,
  type SetHiddenInput,
  type SetPinnedInput,
  filePreferenceEntries,
  filePreferenceActions,
  pinnedParentDirectories,
  pinnedFileEntries,
  type PinnedDirectoryState,
  type PinnedFileEntry,
} from './file-preferences.ts';
