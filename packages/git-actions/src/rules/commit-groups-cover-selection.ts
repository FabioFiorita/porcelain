import type {
  CommitDraftCapture,
  CommitDraftMode,
  CommitGroup,
  CommitGroupLimits,
} from '../models/commit-draft.ts';
import { utf8ByteLength } from './utf8-byte-length.ts';

export function commitGroupsCoverSelection(
  groups: readonly CommitGroup[],
  capture: CommitDraftCapture,
  mode: CommitDraftMode,
  limits: CommitGroupLimits,
): boolean {
  const returned = groups.flatMap((group) => group.paths);
  const selected = new Set(capture.paths);
  return (
    groups.length > 0 &&
    groups.length <= limits.maxGroups &&
    (mode === 'groups' || groups.length === 1) &&
    groups.every(
      (group) =>
        group.message.trim().length > 0 &&
        utf8ByteLength(group.message) <= limits.maxMessageBytes &&
        !group.message.includes('\0') &&
        group.paths.length > 0,
    ) &&
    returned.length === capture.paths.length &&
    new Set(returned).size === returned.length &&
    returned.every((path) => selected.has(path)) &&
    capture.bundles.every((bundle) =>
      groups.some((group) =>
        bundle.every((path) => group.paths.includes(path)),
      ),
    )
  );
}
