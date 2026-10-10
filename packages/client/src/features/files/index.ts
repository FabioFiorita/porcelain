export { readTextFile } from './queries/text.ts';
export {
  readDirectories,
  refreshDirectories,
  type DirectorySelection,
} from './queries/directory.ts';
export { readDirectory } from './queries/directory.ts';
export { readWorktreePaths } from './queries/paths.ts';
export { readAsset } from './queries/asset.ts';
export {
  editFile,
  retainFileDraft,
  moveFileEntries,
  completeFileDraft,
} from './commands/edit-file.ts';
export {
  FileDrafts,
  FileDraftTiming,
  readFileDrafts,
  type FileDraftHandle,
  type FileDraftState,
} from './store.ts';
export type { FileDraftWriteFailure } from './ports/file-draft-writer.ts';

export { readHtmlPreview } from './queries/html-preview.ts';
export {
  HtmlPreviewPlatform,
  HtmlPreviewUnavailable,
} from './ports/html-preview-platform.ts';
export { collectHtmlAssets } from './commands/html-assets.ts';
export type { PreviewAssetFailure } from './ports/html-preview-platform.ts';
