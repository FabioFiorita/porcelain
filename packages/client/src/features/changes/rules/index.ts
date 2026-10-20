export { diffUnavailableReason, omissionReason } from './diff-presentation.ts';
export { diffSelection } from './selection.ts';
export { diffLines, type DiffLine } from './diff-lines.ts';
export { focusPatch, spansLabel, type LineSpan } from './patch-focus.ts';
export { changeId } from './change-id.ts';
export {
  changePath,
  selectionKey,
  type Change,
  type ChangeSelection,
  type ChangesScope,
  type CommitFile,
  type DiffContent,
  type ExpectedFile,
} from './changes.ts';
export {
  branchErrorMessage,
  branchRange,
  type BranchFile,
  type BranchRange,
} from './branch.ts';
export { commitFiles } from './commit-files.ts';
export {
  commitDiffPath,
  isSubmoduleChange,
  showsWorktreeDiff,
} from './diff-eligibility.ts';
export { consecutiveBatches } from './diff-batches.ts';
