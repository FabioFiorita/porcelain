import { CommitGroupsMismatchError } from '../errors/commit-groups-mismatch-error.ts';
import type {
  CommitDraftCapture,
  CommitDraftMode,
  CommitGroup,
} from '../models/commit-draft.ts';

const MAX_GROUPS = 20;
const MAX_MESSAGE_BYTES = 16_384;

export function commitGroupsCoverSelection(
  groups: readonly CommitGroup[],
  capture: CommitDraftCapture,
  mode: CommitDraftMode,
): void {
  const returned = groups.flatMap((group) => group.paths);
  const selected = new Set(capture.paths);
  const covers =
    groups.length > 0 &&
    groups.length <= MAX_GROUPS &&
    (mode === 'groups' || groups.length === 1) &&
    groups.every(
      (group) =>
        group.message.trim().length > 0 &&
        new TextEncoder().encode(group.message).length <= MAX_MESSAGE_BYTES &&
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
    );
  if (!covers) throw new CommitGroupsMismatchError();
}
