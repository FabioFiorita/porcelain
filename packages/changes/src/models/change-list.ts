import type { FileChange } from './change.ts';

export type ReadChangesResult = {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  headOid: string | null;
  inProgress: 'merge' | 'rebase' | null;
  mergeHeadOid: string | null;
  branch: {
    name: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
  } | null;
  changes: (Omit<FileChange, 'fingerprint'> & { fingerprint: string | null })[];
};
