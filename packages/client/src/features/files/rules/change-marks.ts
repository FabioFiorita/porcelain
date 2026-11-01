import type {
  ReadBranchChangesResponse,
  ReadChangesResponse,
} from '@porcelain/contracts/changes';
import { fileTreeAncestors } from './file-tree.ts';

type Change = ReadChangesResponse['changes'][number]['comparisons'][number];
type BranchFile = ReadBranchChangesResponse['files'][number];

export type ChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'untracked';

export const changeStatusMarks: Record<
  ChangeStatus,
  { letter: string; label: string }
> = {
  added: { letter: 'A', label: 'Added' },
  modified: { letter: 'M', label: 'Modified' },
  deleted: { letter: 'D', label: 'Deleted' },
  renamed: { letter: 'R', label: 'Renamed' },
  untracked: { letter: 'U', label: 'Untracked' },
};

export function changeStatus(change: Change): ChangeStatus {
  if (change.scope === 'untracked') return 'untracked';
  if (change.scope === 'unmerged' || change.kind === 'type-changed')
    return 'modified';
  return change.kind;
}

export function branchChangeStatus(
  file: Pick<BranchFile, 'status'>,
): ChangeStatus {
  return file.status === 'type-changed' ? 'modified' : file.status;
}

export type FileChangeMarks = {
  files: ReadonlyMap<string, ChangeStatus>;
  folders: ReadonlySet<string>;
};

function fileChangeMarks(
  changes: readonly { path: string; status: ChangeStatus }[],
): FileChangeMarks {
  const files = new Map<string, ChangeStatus>();
  for (const change of changes)
    if (!files.has(change.path)) files.set(change.path, change.status);
  const current = new Map(changes.map(({ path, status }) => [path, status]));
  return {
    files,
    folders: new Set(
      [...current]
        .filter(([, status]) => status !== 'deleted')
        .flatMap(([path]) => fileTreeAncestors(path)),
    ),
  };
}

export function worktreeChangeMarks(
  changes: readonly { path: string; comparisons: readonly Change[] }[],
): FileChangeMarks {
  return fileChangeMarks(
    changes.flatMap((entry) =>
      entry.comparisons.map((change) => ({
        path: entry.path,
        status: changeStatus(change),
      })),
    ),
  );
}

export function branchChangeMarks(
  files: readonly BranchFile[],
): FileChangeMarks {
  return fileChangeMarks(
    files.map((file) => ({
      path: file.path,
      status: branchChangeStatus(file),
    })),
  );
}
