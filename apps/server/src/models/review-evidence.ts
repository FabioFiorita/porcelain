import type { GitDiffResult } from '@porcelain/git/dtos/git-diff';
import type { GitChange } from '@porcelain/git/dtos/git-status';
import type { TextContent } from './file-content.ts';

export type EvidenceContent =
  | { kind: 'diff'; content: GitDiffResult }
  | (TextContent & { kind: 'file' })
  | {
      kind: 'omitted';
      reason:
        | 'binary'
        | 'conflict'
        | 'content-changed'
        | 'size-limit'
        | 'unsupported-encoding'
        | 'unsupported-git-entry'
        | 'unsupported-submodule'
        | 'unreadable';
    };

export type EvidenceComparison = {
  change: GitChange;
  content: EvidenceContent;
};

export type ReviewEvidence = {
  path: string;
  fingerprint: string | null;
  comparisons: EvidenceComparison[];
};
