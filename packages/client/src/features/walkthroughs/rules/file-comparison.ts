import type { ReadChangesResponse } from '@porcelain/contracts/changes';

type LocalChange =
  ReadChangesResponse['changes'][number]['comparisons'][number];
type BranchFile = { readonly path: string; readonly status?: string };
type LocalFile = {
  readonly path: string;
  readonly comparisons: readonly LocalChange[];
};

type ChangedFiles = {
  readonly branch: readonly BranchFile[] | undefined;
  readonly branchFailed: boolean;
  readonly worktree: readonly LocalFile[];
};

type Comparison =
  | { kind: 'branch' }
  | { kind: 'worktree'; change?: LocalChange | undefined };

function localState(read: ChangedFiles, path: string) {
  const local = read.worktree.find((file) => file.path === path);
  const held = local?.comparisons.find(
    (change) =>
      change.scope === 'unmerged' ||
      ('kind' in change && change.kind === 'deleted'),
  );
  return {
    local,
    held: held && ({ kind: 'worktree', change: held } as const),
  };
}

export function fileComparison(
  read: ChangedFiles,
  path: string,
): Comparison | undefined {
  const { local, held } = localState(read, path);
  if (held) return held;
  if (read.branch === undefined)
    return local ? { kind: 'worktree' } : undefined;
  return read.branch.some((file) => file.path === path)
    ? { kind: 'branch' }
    : { kind: 'worktree' };
}

export function fileOpening(
  read: ChangedFiles,
  path: string,
): Comparison | { kind: 'file' } | undefined {
  const { local, held } = localState(read, path);
  if (held) return held;
  if (read.branch === undefined)
    return read.branchFailed || local ? { kind: 'file' } : undefined;
  return read.branch.find((file) => file.path === path)?.status === 'deleted'
    ? { kind: 'branch' }
    : { kind: 'file' };
}
