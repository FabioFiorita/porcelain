import type {
  CommitDraftUntrackedContent,
  UntrackedFileRead,
} from '../models/commit-draft-evidence.ts';

export function untrackedEvidence(
  worktreeId: string,
  path: string,
  read: UntrackedFileRead,
): CommitDraftUntrackedContent {
  switch (read.kind) {
    case 'text':
      return {
        kind: 'file',
        worktreeId,
        path,
        encoding: 'utf-8',
        byteLength: read.byteLength,
        text: read.text,
      };
    case 'too-large':
      return { kind: 'omitted', reason: 'too-large' };
    case 'failed':
      return { kind: 'omitted', reason: read.failure };
  }
}
