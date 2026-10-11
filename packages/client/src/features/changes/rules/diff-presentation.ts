import type { DiffContent } from './changes.ts';
import { isSubmoduleChange } from './diff-eligibility.ts';

export function omissionReason(
  reason: Extract<DiffContent, { kind: 'omitted' }>['reason'],
) {
  switch (reason) {
    case 'size-limit':
      return 'Too large to show';
    case 'unsupported-submodule':
      return 'Submodule change';
    case 'unsupported-encoding':
      return 'Unsupported text encoding';
  }
}
export function patchUnavailable(content: DiffContent) {
  switch (content.kind) {
    case 'binary':
      return 'Binary change';
    case 'metadata-only':
      return 'No code change';
    case 'omitted':
      return omissionReason(content.reason);
    case 'text':
      return undefined;
  }
}
export function diffUnavailableReason(
  modes: { oldMode: string; newMode: string },
  content: DiffContent | undefined,
  failed: boolean,
) {
  if (isSubmoduleChange(modes)) return 'Submodule change';
  if (content === undefined)
    return failed ? 'The patch could not be read' : 'Reading the patch';
  return patchUnavailable(content);
}
